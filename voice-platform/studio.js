import { api, signIn, signOut, showStatus } from './backend.js';

const byId = id => document.getElementById(id);
const file = byId('audio-file');
const transcript = byId('transcript');
const transcriptStatus = byId('transcribe-status');
const transcribeButton = byId('transcribe');
const recordButton = byId('record');
const stopRecording = byId('stop-recording');
const downloadTranscript = byId('download-transcript');
const voiceLanguage = byId('tts-language');
const voiceOptions = byId('tts-voice');
const ttsStatus = byId('tts-status');
const agentStatus = byId('agent-status');
const connect = byId('connect-agent');
const selectAgent = byId('agent-selection');
const synth = window.speechSynthesis;
const demoAgent = {
  locale: 'en-IN',
  greeting: 'Hello. Welcome to AAROHAN AI WORLD.',
  answer: 'Thank you for your enquiry. We can help with voice agents, lead tracking and WhatsApp automation. Please contact our team through the website to discuss your requirements.',
};
const outputLocales = { english: 'en-IN', hindi: 'hi-IN', gujarati: 'gu-IN' };
let transcriptLocale;
let voices = [];
let worker;
let workerModel;
let recorder;
let recordingTimeout;
let processing = false;
let agentToken;
let agentExpiration;
let deployments = [];
let currentAgent = demoAgent;
let agentBusy = false;
let agentSessionId = 0;
let agentTurnId = 0;
let agentConnecting = false;
let playbackId = 0;
let managedPlayback = false;

function updateAudioControls() {
  const recording = recorder?.state === 'recording';
  file.disabled = processing || recording;
  transcribeButton.disabled = processing || recording || !file.files.length;
  recordButton.disabled = processing || recording || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder;
  stopRecording.hidden = !recording;
}

async function audioSamples(blob) {
  if (blob.size === 0) throw new Error('The recording is empty. Record again or choose another audio file.');
  if (blob.size > 12 * 1024 * 1024) throw new Error('Choose an audio file under 12 MB.');
  const context = new AudioContext();
  let audio;
  try {
    audio = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await context.close();
  }
  if (!audio.length || audio.duration > 30.5) throw new Error('Choose an audio file up to 30 seconds.');
  // Check the decoded channels before browser resampling can introduce tiny differences.
  let hasSignal = false;
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const pcm = audio.getChannelData(channel);
    if (pcm.some(sample => Math.abs(sample - pcm[0]) > 1e-7)) {
      hasSignal = true;
      break;
    }
  }
  if (!hasSignal) throw new Error('No audio signal detected. Check your microphone or choose another audio file.');
  const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
  const source = offline.createBufferSource();
  source.buffer = audio;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);
  // A disconnected input can produce a flat line, including a constant DC offset.
  // Keep quiet recordings with any variation eligible for recognition.
  if (!samples.some(sample => sample !== samples[0])) {
    throw new Error('No audio signal detected. Check your microphone or choose another audio file.');
  }
  return samples;
}

function recognize(samples, language, task) {
  const model = byId('speech-model').value;
  if (worker && workerModel !== model) {
    worker.terminate();
    worker = undefined;
  }
  workerModel = model;
  worker ??= new Worker(new URL('./transcriber.js?v=multilingual-2', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => stop(new Error('Transcription took too long. Try a shorter recording.')), model === 'small' ? 420000 : 180000);
    function stop(error, output) {
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (error) {
        worker.terminate();
        worker = undefined;
        reject(error);
      } else {
        resolve(output);
      }
    }
    worker.onmessage = ({ data }) => {
      if (data.type === 'loading') showStatus(transcriptStatus, 'Downloading speech model…');
      if (data.type === 'processing') showStatus(transcriptStatus, 'Transcribing audio on this device…');
      if (data.type === 'complete') stop(null, data.text);
      if (data.type === 'error') stop(new Error('Transcription failed. Check the model download or try a different audio format.'));
    };
    worker.onerror = () => stop(new Error('The speech model could not start in this browser.'));
    worker.postMessage({ samples, language, task, model }, [samples.buffer]);
  });
}

function hasRepeatedPhrase(text) {
  const words = text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  // A long, exact decoding loop is unreliable for a clip limited to 30 seconds.
  for (let size = 1; size <= Math.min(12, Math.floor(words.length / 8)); size++) {
    let streak = 0;
    for (let i = size; i < words.length; i++) {
      streak = words[i] === words[i - size] ? streak + 1 : 0;
      if (streak >= Math.max(32, size * 7)) return true;
    }
  }
  return false;
}

async function transcribeAudio(blob) {
  if (processing || !blob) return;
  processing = true;
  updateAudioControls();
  showStatus(transcriptStatus, 'Preparing audio…');
  try {
    const language = byId('spoken-language').value;
    const task = byId('transcription-task').value;
    const result = await recognize(await audioSamples(blob), language, task);
    if (hasRepeatedPhrase(result)) {
      throw new Error('Speech recognition repeated the same phrase too many times. Try a shorter recording.');
    }
    transcript.value = result;
    transcriptLocale = task === 'translate' ? 'en-IN' : outputLocales[language];
    downloadTranscript.disabled = !transcript.value;
    byId('read-transcript').disabled = !transcript.value;
    showStatus(transcriptStatus, transcript.value ? 'Transcript ready.' : 'No speech was recognized.');
  } catch (error) {
    transcript.value = '';
    downloadTranscript.disabled = true;
    byId('read-transcript').disabled = true;
    showStatus(transcriptStatus, error.message, true);
  } finally {
    processing = false;
    updateAudioControls();
  }
}

file.addEventListener('change', updateAudioControls);
transcribeButton.addEventListener('click', () => transcribeAudio(file.files[0]));
recordButton.addEventListener('click', async () => {
  let stream;
  recordButton.disabled = true;
  file.disabled = true;
  transcribeButton.disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
    recorder.onerror = () => {
      clearTimeout(recordingTimeout);
      stream.getTracks().forEach(track => track.stop());
      recorder = undefined;
      updateAudioControls();
      showStatus(transcriptStatus, 'Microphone recording failed.', true);
    };
    recorder.onstop = () => {
      clearTimeout(recordingTimeout);
      stream.getTracks().forEach(track => track.stop());
      if (!recorder) return;
      const type = recorder.mimeType;
      recorder = undefined;
      updateAudioControls();
      transcribeAudio(new Blob(chunks, { type }));
    };
    recorder.start();
    recordingTimeout = setTimeout(() => recorder?.state === 'recording' && recorder.stop(), 29000);
    showStatus(transcriptStatus, 'Recording. Stops automatically after 29 seconds.');
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    recorder = undefined;
    showStatus(transcriptStatus, error.name === 'NotAllowedError' ? 'Microphone access was not granted.' : 'Microphone unavailable.', true);
  } finally {
    updateAudioControls();
  }
});
stopRecording.addEventListener('click', () => {
  if (recorder?.state === 'recording') recorder.stop();
});
downloadTranscript.addEventListener('click', () => {
  if (!transcript.value) return;
  const url = URL.createObjectURL(new Blob([transcript.value], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'aarohan-transcript.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function refreshVoices() {
  const previous = voiceOptions.value;
  const languagePrefix = voiceLanguage.value.split('-')[0].toLowerCase();
  voices = (synth?.getVoices() ?? []).filter(voice => voice.localService && voice.lang.toLowerCase().split(/[-_]/)[0] === languagePrefix);
  voiceOptions.replaceChildren(...voices.map(voice => new Option(voice.name, voice.voiceURI)));
  if (!voices.length) voiceOptions.append(new Option('No installed voice for this language', ''));
  if (voices.some(voice => voice.voiceURI === previous)) voiceOptions.value = previous;
}

function stopPlayback() {
  playbackId++;
  managedPlayback = false;
  synth?.cancel();
}

function readAloud(text, locale, voice, status = ttsStatus) {
  if (!text.trim()) return 'Enter text to read aloud.';
  if (!synth) return 'Audio playback is unavailable in this browser.';
  const prefix = locale.split('-')[0].toLowerCase();
  const available = voice ?? synth.getVoices().find(item => item.localService && item.lang.toLowerCase().split(/[-_]/)[0] === prefix);
  if (!available) return 'No installed voice for this language. Read the text on screen.';
  stopPlayback();
  const id = playbackId;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = available;
  utterance.lang = available.lang;
  utterance.onerror = event => {
    if (id !== playbackId) return;
    managedPlayback = false;
    if (!['canceled', 'interrupted'].includes(event.error)) showStatus(status, 'This device could not play the selected voice.', true);
  };
  utterance.onend = () => { if (id === playbackId) managedPlayback = false; };
  managedPlayback = status === agentStatus;
  try { synth.speak(utterance); } catch {
    if (id === playbackId) managedPlayback = false;
    return 'This device could not play the selected voice.';
  }
  return '';
}

voiceLanguage.addEventListener('change', refreshVoices);
synth?.addEventListener('voiceschanged', refreshVoices);
refreshVoices();
byId('speak').addEventListener('click', () => {
  const error = readAloud(byId('tts-text').value, voiceLanguage.value, voices.find(voice => voice.voiceURI === voiceOptions.value));
  showStatus(ttsStatus, error, Boolean(error));
});
byId('stop-speaking').addEventListener('click', stopPlayback);
byId('read-transcript').addEventListener('click', () => {
  if (!transcript.value) return;
  const error = readAloud(transcript.value, transcriptLocale, undefined, transcriptStatus);
  showStatus(transcriptStatus, error || 'Transcript ready.', Boolean(error));
});
byId('use-transcript').addEventListener('click', () => {
  if (!transcript.value) return;
  byId('tts-text').value = transcript.value.slice(0, 3000);
  voiceLanguage.value = transcriptLocale;
  refreshVoices();
});
byId('use-agent-transcript').addEventListener('click', () => { byId('visitor-message').value = transcript.value.slice(0, 3000); });

function showAgent(agent) {
  currentAgent = agent;
  byId('agent-greeting').textContent = agent.greeting;
  byId('agent-reply').textContent = '';
}

function resetAgentTurn() {
  agentTurnId++;
  if (managedPlayback) stopPlayback();
  agentBusy = false;
  byId('run-agent').disabled = false;
}

function disconnect() {
  agentSessionId++;
  agentConnecting = false;
  connect.querySelector('button').disabled = false;
  resetAgentTurn();
  clearTimeout(agentExpiration);
  byId('visitor-message').value = '';
  byId('agent-password').value = '';
  agentToken = undefined;
  deployments = [];
  selectAgent.replaceChildren();
  byId('connect-details').hidden = false;
  byId('connected-agent').hidden = true;
  showAgent(demoAgent);
}

function validDeployment(row) {
  return !!row && typeof row.id === 'string' && row.id.length > 0 &&
    typeof row.name === 'string' && typeof row.greeting === 'string' &&
    typeof row.answer === 'string' && typeof row.locale === 'string' && row.locale.trim().length > 0;
}

function agentQuery(id) {
  return '/rest/v1/voice_deployments?select=id,name,locale,greeting,answer&enabled=eq.true' +
    (id ? '&id=eq.' + encodeURIComponent(id) : '&order=name.asc&limit=200');
}

async function logEvent(token, id, eventType) {
  if (token !== agentToken) return;
  await api('/rest/v1/voice_events', {
    method: 'POST', token, prefer: 'return=minimal',
    data: { deployment_id: id, event_type: eventType },
  });
}

async function chooseDeployment() {
  const agent = deployments.find(row => row.id === selectAgent.value);
  if (!agent) return;
  resetAgentTurn();
  showAgent(agent);
  const turn = agentTurnId;
  const token = agentToken;
  try {
    await logEvent(token, agent.id, 'connected');
    if (turn === agentTurnId && token === agentToken && currentAgent.id === agent.id) showStatus(agentStatus, 'Connected to ' + agent.name + '.');
  } catch {
    if (turn === agentTurnId && token === agentToken && currentAgent.id === agent.id) showStatus(agentStatus, 'Agent loaded. Activity could not be recorded.', true);
  }
}

connect.addEventListener('submit', async event => {
  event.preventDefault();
  if (agentConnecting || agentToken) return;
  agentConnecting = true;
  const attempt = ++agentSessionId;
  const current = () => attempt === agentSessionId;
  const button = connect.querySelector('button');
  button.disabled = true;
  showStatus(agentStatus, 'Connecting…');
  let session;
  try {
    session = await signIn(byId('agent-email').value, byId('agent-password').value);
    if (!current()) return;
    if (typeof session?.access_token !== 'string' || !session.access_token ||
        !Number.isFinite(session.expires_in) || session.expires_in <= 0) throw new Error('Invalid session');
    agentToken = session.access_token;
    agentExpiration = setTimeout(() => {
      if (!current()) return;
      disconnect();
      showStatus(agentStatus, 'Your managed agent session expired.');
    }, session.expires_in * 1000);
    const rows = await api(agentQuery(), { token: agentToken });
    if (!current()) return;
    if (!Array.isArray(rows) || !rows.every(validDeployment)) throw new Error('Invalid deployment list');
    deployments = rows;
    if (!deployments.length) {
      const previous = agentToken;
      disconnect();
      showStatus(agentStatus, 'There are no enabled deployments assigned to this account.', true);
      await signOut(previous).catch(() => {});
      return;
    }
    const requestedId = new URLSearchParams(location.search).get('agent');
    selectAgent.replaceChildren(...deployments.map(agent => new Option(agent.name, agent.id)));
    if (deployments.some(agent => agent.id === requestedId)) selectAgent.value = requestedId;
    byId('connect-details').hidden = true;
    byId('connected-agent').hidden = false;
    await chooseDeployment();
  } catch {
    if (!current()) return;
    const previous = agentToken;
    disconnect();
    showStatus(agentStatus, 'Could not connect. Check your login and deployment assignment.', true);
    if (previous) await signOut(previous).catch(() => {});
  } finally {
    if (current()) {
      agentConnecting = false;
      byId('agent-password').value = '';
      button.disabled = false;
    }
  }
});

selectAgent.addEventListener('change', chooseDeployment);
byId('disconnect-agent').addEventListener('click', async () => {
  const previous = agentToken;
  disconnect();
  showStatus(agentStatus, 'Disconnected. The local demo is ready.');
  if (previous) await signOut(previous).catch(() => {});
});

byId('run-agent').addEventListener('click', async () => {
  if (!byId('visitor-message').value.trim()) {
    showStatus(agentStatus, 'Enter a visitor message first.', true);
    return;
  }
  if (agentBusy) return;
  agentBusy = true;
  const turn = ++agentTurnId;
  const button = byId('run-agent');
  const session = agentToken;
  const deployment = currentAgent.id;
  const current = () => turn === agentTurnId && session === agentToken && currentAgent.id === deployment;
  button.disabled = true;
  showStatus(agentStatus, '');
  try {
    if (deployment) {
      const rows = await api(agentQuery(deployment), { token: session });
      if (!current()) return;
      if (!Array.isArray(rows) || !rows.every(validDeployment) || rows.length > 1 || (rows.length && rows[0].id !== deployment)) throw new Error('Invalid deployment response');
      if (!rows.length) {
        disconnect();
        showStatus(agentStatus, 'This deployment is no longer available. The local demo is ready.', true);
        await signOut(session).catch(() => {});
        return;
      }
      showAgent(rows[0]);
    }
    byId('agent-reply').textContent = currentAgent.answer;
    const audioError = readAloud(currentAgent.answer, currentAgent.locale, undefined, agentStatus);
    if (audioError) showStatus(agentStatus, audioError);
    if (deployment) {
      await logEvent(session, deployment, audioError ? 'runtime_error' : 'turn_completed').catch(() => {
        if (current()) showStatus(agentStatus, 'Reply shown. Activity could not be recorded.', true);
      });
    }
  } catch (error) {
    if (current()) {
      if (session && [401, 403].includes(error?.status)) {
        disconnect();
        showStatus(agentStatus, 'Access expired or was denied. Sign in again to use a managed agent.', true);
        await signOut(session).catch(() => {});
      } else {
        showStatus(agentStatus, 'Could not load the deployment. Try again.', true);
      }
    }
  } finally {
    if (current()) {
      agentBusy = false;
      button.disabled = false;
    }
  }
});

showAgent(demoAgent);
updateAudioControls();

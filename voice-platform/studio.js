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
let recorder;
let recordingTimeout;
let processing = false;
let agentToken;
let agentExpiration;
let deployments = [];
let currentAgent = demoAgent;
let agentBusy = false;

function updateAudioControls() {
  const recording = recorder?.state === 'recording';
  file.disabled = processing || recording;
  transcribeButton.disabled = processing || recording || !file.files.length;
  recordButton.disabled = processing || recording || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder;
  stopRecording.hidden = !recording;
}

async function audioSamples(blob) {
  if (blob.size > 12 * 1024 * 1024) throw new Error('Choose an audio file under 12 MB.');
  const context = new AudioContext();
  let audio;
  try {
    audio = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await context.close();
  }
  if (!audio.length || audio.duration > 30.5) throw new Error('Choose an audio file up to 30 seconds.');
  const offline = new OfflineAudioContext(1, Math.ceil(audio.duration * 16000), 16000);
  const source = offline.createBufferSource();
  source.buffer = audio;
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0);
}

function recognize(samples, language, task) {
  worker ??= new Worker(new URL('./transcriber.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => stop(new Error('Transcription took too long. Try a shorter recording.')), 180000);
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
    worker.postMessage({ samples, language, task }, [samples.buffer]);
  });
}

async function transcribeAudio(blob) {
  if (processing || !blob) return;
  processing = true;
  updateAudioControls();
  showStatus(transcriptStatus, 'Preparing audio…');
  try {
    const language = byId('spoken-language').value;
    const task = byId('transcription-task').value;
    transcript.value = await recognize(await audioSamples(blob), language, task);
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

function readAloud(text, locale, voice, status = ttsStatus) {
  if (!text.trim()) return 'Enter text to read aloud.';
  if (!synth) return 'Audio playback is unavailable in this browser.';
  const prefix = locale.split('-')[0].toLowerCase();
  const available = voice ?? synth.getVoices().find(item => item.localService && item.lang.toLowerCase().split(/[-_]/)[0] === prefix);
  if (!available) return 'No installed voice for this language. Read the text on screen.';
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = available;
  utterance.lang = available.lang;
  utterance.onerror = event => {
    if (!['canceled', 'interrupted'].includes(event.error)) showStatus(status, 'This device could not play the selected voice.', true);
  };
  synth.speak(utterance);
  return '';
}

voiceLanguage.addEventListener('change', refreshVoices);
synth?.addEventListener('voiceschanged', refreshVoices);
refreshVoices();
byId('speak').addEventListener('click', () => {
  const error = readAloud(byId('tts-text').value, voiceLanguage.value, voices.find(voice => voice.voiceURI === voiceOptions.value));
  showStatus(ttsStatus, error, Boolean(error));
});
byId('stop-speaking').addEventListener('click', () => synth?.cancel());
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

function disconnect() {
  clearTimeout(agentExpiration);
  agentToken = undefined;
  deployments = [];
  selectAgent.replaceChildren();
  byId('connect-details').hidden = false;
  byId('connected-agent').hidden = true;
  showAgent(demoAgent);
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
  showAgent(agent);
  const token = agentToken;
  try {
    await logEvent(token, agent.id, 'connected');
    if (token === agentToken && currentAgent.id === agent.id) showStatus(agentStatus, 'Connected to ' + agent.name + '.');
  } catch {
    if (token === agentToken && currentAgent.id === agent.id) showStatus(agentStatus, 'Agent loaded. Activity could not be recorded.', true);
  }
}

connect.addEventListener('submit', async event => {
  event.preventDefault();
  const button = connect.querySelector('button');
  button.disabled = true;
  showStatus(agentStatus, 'Connecting…');
  try {
    const session = await signIn(byId('agent-email').value, byId('agent-password').value);
    agentToken = session.access_token;
    deployments = await api(agentQuery(), { token: agentToken });
    if (!deployments.length) {
      await signOut(agentToken).catch(() => {});
      disconnect();
      showStatus(agentStatus, 'There are no enabled deployments assigned to this account.', true);
      return;
    }
    const requestedId = new URLSearchParams(location.search).get('agent');
    selectAgent.replaceChildren(...deployments.map(agent => new Option(agent.name, agent.id)));
    if (deployments.some(agent => agent.id === requestedId)) selectAgent.value = requestedId;
    byId('connect-details').hidden = true;
    byId('connected-agent').hidden = false;
    agentExpiration = setTimeout(() => {
      disconnect();
      showStatus(agentStatus, 'Your managed agent session expired.');
    }, session.expires_in * 1000);
    await chooseDeployment();
  } catch {
    if (agentToken) await signOut(agentToken).catch(() => {});
    disconnect();
    showStatus(agentStatus, 'Could not connect. Check your login and deployment assignment.', true);
  } finally {
    byId('agent-password').value = '';
    button.disabled = false;
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
  const button = byId('run-agent');
  const session = agentToken;
  const deployment = currentAgent.id;
  button.disabled = true;
  showStatus(agentStatus, '');
  try {
    if (deployment) {
      const rows = await api(agentQuery(deployment), { token: session });
      if (session !== agentToken || currentAgent.id !== deployment) return;
      if (!rows.length) {
        disconnect();
        await signOut(session).catch(() => {});
        showStatus(agentStatus, 'This deployment is no longer available. The local demo is ready.', true);
        return;
      }
      showAgent(rows[0]);
    }
    byId('agent-reply').textContent = currentAgent.answer;
    const audioError = readAloud(currentAgent.answer, currentAgent.locale);
    if (audioError) showStatus(agentStatus, audioError);
    if (deployment) {
      await logEvent(session, deployment, audioError ? 'runtime_error' : 'turn_completed').catch(() => {
        if (session === agentToken && deployment === currentAgent.id) showStatus(agentStatus, 'Reply shown. Activity could not be recorded.', true);
      });
    }
  } catch {
    if (session === agentToken && deployment === currentAgent.id) showStatus(agentStatus, 'Could not load the deployment. Try again.', true);
  } finally {
    agentBusy = false;
    button.disabled = false;
  }
});

showAgent(demoAgent);
updateAudioControls();

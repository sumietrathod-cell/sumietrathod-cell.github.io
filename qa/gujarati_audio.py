import asyncio, base64, json, pathlib
import websockets
AGENT = "agent_6701m7cb57dkftcbkvd0ggfdd2ep"

async def check():
    url = "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=" + AGENT
    async with websockets.connect(url, origin="https://aarohanaiworld.com") as ws:
        await ws.send(json.dumps({"type":"conversation_initiation_client_data"}))
        sent = asyncio.Event()
        async def speak():
            await asyncio.sleep(12)
            pcm = pathlib.Path("/tmp/question.pcm").read_bytes()
            for start in range(0,len(pcm)+160000,3200):
                block = pcm[start:start+3200].ljust(3200,b"\0")
                await ws.send(json.dumps({"user_audio_chunk":base64.b64encode(block).decode()}))
                await asyncio.sleep(.1)
            sent.set()
        sender = asyncio.create_task(speak())
        heard = False
        try:
            async with asyncio.timeout(65):
                async for packet in ws:
                    e = json.loads(packet)
                    if e["type"] == "ping":
                        await ws.send(json.dumps({"type":"pong","event_id":e["ping_event"]["event_id"]}))
                    if e["type"] == "user_transcript":
                        heard = True
                        print("Synthetic question recognized:",e["user_transcription_event"]["user_transcript"],flush=True)
                    if heard and e["type"] == "agent_response":
                        print("Synthetic test reply:",e["agent_response_event"]["agent_response"],flush=True)
                        return
        finally:
            sender.cancel()
        raise RuntimeError("No reply to synthetic question")
asyncio.run(check())

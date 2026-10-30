# makes music.wav (26 s soft beat) in the current folder; pass seconds as arg
import numpy as np, wave, sys
sr=44100;D=float(sys.argv[1]) if len(sys.argv)>1 else 26.0;n=int(sr*D);out=np.zeros(n)
bpm=118;beat=60/bpm;chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]]
f=lambda m:440*2**((m-69)/12);bar=beat*4
for i in range(int(D/bar)+1):
    s=int(i*bar*sr);e=min(n,int((i+1)*bar*sr))
    if s>=n:break
    tt=np.arange(e-s)/sr;env=np.minimum(1,tt/0.3)*np.exp(-tt*0.4)
    for m in chords[i%4]: out[s:e]+=0.05*env*(np.sin(2*np.pi*f(m)*tt)+0.3*np.sin(2*np.pi*2*f(m)*tt))
    bm=chords[i%4][0]-12
    for k in range(8):
        ss=s+int(k*beat/2*sr);L=int(0.2*sr)
        if ss+L<n: tb=np.arange(L)/sr;out[ss:ss+L]+=0.09*np.exp(-tb*12)*np.sin(2*np.pi*f(bm)*tb)
for k in range(int(D/beat)):
    s=int(k*beat*sr);L=int(0.25*sr)
    if s+L>n:break
    tb=np.arange(L)/sr;fr=50+90*np.exp(-tb*30);out[s:s+L]+=0.45*np.exp(-tb*14)*np.sin(2*np.pi*np.cumsum(fr)/sr)
    h=s+int(beat/2*sr);Lh=int(0.05*sr)
    if h+Lh<n: out[h:h+Lh]+=0.06*np.random.randn(Lh)*np.exp(-np.arange(Lh)/sr*80)
fade=int(1.5*sr);out[-fade:]*=np.linspace(1,0,fade);out=out/np.abs(out).max()*0.8
st=(np.repeat(out[:,None],2,1)*32767).astype(np.int16)
w=wave.open('music.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(st.tobytes());w.close()

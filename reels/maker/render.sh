set -e
V=/home/claude/vid
ENC="-c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -r 30 -an"
still(){ # name png dur fadein
  ffmpeg -v error -y -framerate 30 -i $2 -vf "format=yuv420p,loop=-1:1,trim=duration=$3,fade=in:st=0:d=$4" $ENC tmp_$1.mp4 && mv tmp_$1.mp4 sc_$1.mp4; }
phone(){ # name strip cap dur y0 y1 hdr
  D=$4; HD=""; HO="[v2]copy[v3]"
  if [ "$7" = 1 ]; then HO="[2]scale=744:172,loop=-1:1,trim=duration=$D,setpts=N/30/TB[h];[v2][h]overlay=168:218[v3]"; fi
  ffmpeg -v error -y -framerate 30 -i bg.png -framerate 30 -i $V/$2 -framerate 30 -i $V/hdr.jpg -framerate 30 -i frame.png -framerate 30 -i $3 -filter_complex "
[0]loop=-1:1,trim=duration=$D,setpts=N/30/TB[b];
[1]scale=744:-1,loop=-1:1,trim=duration=$D,setpts=N/30/TB,crop=744:1204:0:'$5+($6-$5)*(0.5-0.5*cos(PI*min(max(t-0.3,0)/($D-0.6),1)))'[c];
[b][c]overlay=168:218[v2];$HO;
[3]loop=-1:1,trim=duration=$D,setpts=N/30/TB[f];[4]format=rgba,loop=-1:1,trim=duration=$D,setpts=N/30/TB,fade=in:st=0.1:d=0.3:alpha=1[cp];
[v3][f]overlay[v4];[v4][cp]overlay,format=yuv420p" -t $D $ENC tmp_$1.mp4 && mv tmp_$1.mp4 sc_$1.mp4; }
still 1 hook1.png 2.2 0.25
still 2 hook2.png 2.0 0.15
phone 3 st_hero.jpg cap_hero.png 3.5 0 560 0
phone 4 st_demo.jpg cap_demo.png 3.5 60 760 1
phone 5 st_agents.jpg cap_agents.png 4.0 0 6800 1
phone 6 st_dash.jpg cap_dash.png 3.0 0 400 1
phone 7 st_price.jpg cap_price.png 3.0 80 900 1
still 8 cta.png 4.3 0.2
ls sc_*.mp4 | sed "s/.*/file '&'/" > list.txt
ffmpeg -v error -y -f concat -safe 0 -i list.txt -c copy vonly.mp4
ffmpeg -v error -y -i vonly.mp4 -i music.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -af "afade=t=out:st=24:d=1.5" Aarohan_Reel.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 Aarohan_Reel.mp4

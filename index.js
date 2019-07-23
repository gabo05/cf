const express = require('express')
const app = express()
const fs = require('fs');
const sys = require('sys');
const { createCanvas, loadImage } = require('canvas')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const command = ffmpeg();

const port = 3000;

app.use(express.json());
app.use('/', express.static('public'));

function generate(callback){
    const canvas = createCanvas(800, 600);

    var c = canvas.getContext('2d'),
    w = canvas.width, h = canvas.height,
    p = [], clr, n = 200,
    // frame identifier
    counter = 0;
    
    clr = [ 'red', 'green', 'blue', 'yellow', 'purple' ];
    
    for (var i = 0; i < n; i++) {
        // generate particle with random initial velocity, radius, and color
        p.push({
            x: w/2,
            y: h/2,
            vx: Math.random()*12-6,
            vy: Math.random()*12-6,
            r: Math.random()*4+3,
            clr: Math.floor(Math.random()*clr.length)
        });
    }
    
    function frame() {
        if(counter >= 150){
            console.log('The PNG files were created.')
            callback();
            return;
        }
        // cover the canvas with 50% opacity (creates fading trails)
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(0, 0, w, h);
    
        for (var i = 0; i < n; i++) {
            // reduce velocity to 99%
            p[i].vx *= 0.99;
            p[i].vy *= 0.99;
    
            // adjust position by the current velocity
            p[i].x += p[i].vx;
            p[i].y += p[i].vy;
    
            // detect collisions with the edges
            if (p[i].x < p[i].r || p[i].x > w-p[i].r) {
                // reverse velocity (direction)
                p[i].vx = -p[i].vx;
                // adjust position again (in case it already passed the edge)
                p[i].x += p[i].vx;
            }
            // see above
            if (p[i].y < p[i].r || p[i].y > h-p[i].r) {
                p[i].vy = -p[i].vy;
                p[i].y += p[i].vy;
            }
    
            // draw the circle at the new postion
            c.fillStyle = clr[p[i].clr]; // set color
            c.beginPath();
            c.arc(p[i].x, p[i].y, p[i].r, 0, Math.PI*2, false);
            c.fill();
        }
        
        const out = fs.createWriteStream(__dirname + `/frames/image${counter++}.png`);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        out.on('finish', () =>  true);
        setTimeout(() => {
            frame();
        }, 100);
    }
    // start the whole process
    frame();
}

app.get('/generate', function(req, res){
    // res.send('generating...');
    var timemark = null;
    function onProgress(progress){
        if (progress.timemark != timemark) {
            timemark = progress.timemark;
            console.log(JSON.stringify(progress));
        }
    }
    function onError(err, stdout, stderr) {
        console.log('Cannot process video: ' + err.message);
    }
    function onEnd() {
        console.log('Finished processing');
    }
    console.log(JSON.stringify(req.query));
    generate(() => {
        command
        .on('end', onEnd )
        .on('progress', onProgress)
        .on('error', onError)
        .input('frames/image%d.png')
        .inputFPS(1/parseInt(req.query.ifps))
        .videoCodec('mpeg4')
        .output('frames/video.mp4')
        .outputFPS(parseInt(req.query.ofps))
        .noAudio()
        .run();
        res.send('generated');
    });
    // res.send('generated');
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
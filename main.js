// Single-file Space Rocket Adventure with 5-second shield when collecting golden star.
  (function(){
    class SpaceRocketGame {
      constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameState = 'start'; // 'start' | 'playing' | 'gameOver'

        // Rocket
        this.rocket = { x:100, y:300, width:40, height:60, velocity:0, gravity:0.18, jumpPower:-5.0 };

        // Entities
        this.obstacles = [];
        this.backgroundStars = [];
        this.powerUps = []; // golden stars (power-ups)

        // Gameplay
        this.score = 0;
        this.highScore = this.loadHighScore();
        this.obstacleSpeed = 2.0;
        this.frameCount = 0;

        // Shield
        this.shieldActive = false;
        this.shieldEndAt = 0; // timestamp in ms

        // Audio
        this.audioCtx = null;
        this.initAudio();

        // UI elements
        this.scoreEl = document.getElementById('scoreDisplay');
        this.highScoreEl = document.getElementById('highScoreDisplay');
        this.startScreen = document.getElementById('startScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.finalScoreEl = document.getElementById('finalScore');
        this.newHighEl = document.getElementById('newHighScore');
        this.shieldTimerEl = document.getElementById('shieldTimer');

        this.initBackgroundStars();
        this.bindEvents();
        this.updateHighScoreDisplay();
        this.gameLoop();
      }

      // ---------- Audio ----------
      initAudio(){
        try {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { this.audioCtx = null; }
      }

      playTone(freq, duration = 0.08, type='sine') {
        if(!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        g.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
        o.connect(g); g.connect(this.audioCtx.destination);
        o.start(this.audioCtx.currentTime);
        o.stop(this.audioCtx.currentTime + duration);
      }

      playPowerUpSound(){
        // small chime sequence
        this.playTone(880, 0.08, 'sine');
        setTimeout(()=>this.playTone(1100,0.06,'sine'), 90);
      }
      playThrusterSound(){ this.playTone(260,0.08,'sawtooth'); }
      playCrashSound(){
        if(!this.audioCtx) return;
        for(let i=0;i<6;i++){ setTimeout(()=>this.playTone(180 - i*12,0.06,'sawtooth'), i*60); }
      }

      // ---------- Background stars ----------
      initBackgroundStars(){
        for(let i=0;i<120;i++){
          this.backgroundStars.push({
            x: Math.random()*this.canvas.width,
            y: Math.random()*this.canvas.height,
            size: Math.random()*1.6 + 0.3,
            speed: Math.random()*0.4 + 0.15,
            pulse: Math.random()*6
          });
        }
      }

      // ---------- Events ----------
      bindEvents(){
        // Click to boost
        this.canvas.addEventListener('click', ()=>this.handleInput());
        document.getElementById('startBtn').addEventListener('click', ()=>this.startGame());
        document.getElementById('restartBtn').addEventListener('click', ()=>this.restartGame());

        window.addEventListener('keydown', (e)=>{
          if(e.code === 'Space'){
            e.preventDefault();
            if(this.gameState === 'start') this.startGame();
            this.handleInput();
          }
        });

        // prevent scroll on spacebar
        window.addEventListener('keydown', (e)=>{ if(e.code === 'Space') e.preventDefault(); });
      }

      handleInput(){
        if(this.gameState !== 'playing') return;
        this.rocket.velocity = this.rocket.jumpPower;
        this.playThrusterSound();
      }

      // ---------- Game control ----------
      startGame(){
        this.gameState = 'playing';
        this.resetGame();
        this.startScreen.style.display = 'none';
        if(this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
      }

      restartGame(){
        this.gameState = 'playing';
        this.resetGame();
        this.gameOverScreen.style.display = 'none';
      }

      resetGame(){
        this.rocket = { x:100, y:this.canvas.height/2 - 30, width:40, height:60, velocity:0, gravity:0.18, jumpPower:-5.0 };
        this.obstacles = [];
        this.powerUps = [];
        this.score = 0;
        this.frameCount = 0;
        this.obstacleSpeed = 2.0;
        this.shieldActive = false;
        this.shieldEndAt = 0;
        this.updateScoreDisplay();
        this.updateHighScoreDisplay();
        this.shieldTimerEl.style.display = 'none';
      }

      // ---------- Spawning ----------
      generateObstacle(){
        const size = Math.random()*40 + 30;
        const gap = 180 + Math.random()*50;
        const minY = 30;
        const maxTop = this.canvas.height - gap - minY - size;
        const topY = minY + Math.random() * Math.max(1, maxTop - minY);

        // top
        this.obstacles.push({
          x: this.canvas.width + 20,
          y: topY - size,
          width: size,
          height: size,
          rotation: 0,
          rotationSpeed: (Math.random()-0.5)*0.12,
          scored: false,
          position: 'top'
        });

        // bottom
        const bottomSize = size * (0.75 + Math.random()*0.3);
        this.obstacles.push({
          x: this.canvas.width + 20,
          y: topY + gap,
          width: bottomSize,
          height: bottomSize,
          rotation: 0,
          rotationSpeed: (Math.random()-0.5)*0.12,
          scored: false,
          position: 'bottom'
        });
      }

      generatePowerUp(){
        const size = 28;
        this.powerUps.push({
          x: this.canvas.width + 40,
          y: Math.random()*(this.canvas.height - size*2) + size,
          size: size,
          collected: false
        });
      }

      // ---------- Update ----------
      update(){
        if(this.gameState !== 'playing') return;

        this.frameCount++;

        // rocket physics
        this.rocket.velocity += this.rocket.gravity;
        this.rocket.y += this.rocket.velocity;

        // background stars movement
        for(const s of this.backgroundStars){
          s.x -= s.speed;
          if(s.x < -5){ s.x = this.canvas.width + 5; s.y = Math.random()*this.canvas.height; }
        }

        // spawn obstacles
        if(this.frameCount % 120 === 0) this.generateObstacle();

        // spawn power-up every ~10 seconds (600 frames)
        if(this.frameCount % 600 === 0) this.generatePowerUp();

        // move obstacles
        for(let i=this.obstacles.length-1;i>=0;i--){
          const ob = this.obstacles[i];
          ob.x -= this.obstacleSpeed;
          ob.rotation += ob.rotationSpeed;
          if(!ob.scored && ob.x + ob.width < this.rocket.x){
            ob.scored = true;
            this.score++;
            this.updateScoreDisplay();
            this.playTone(600,0.08,'sine');
          }
          if(ob.x + ob.width < -60) this.obstacles.splice(i,1);
        }

        // move power-ups
        for(let i=this.powerUps.length-1;i>=0;i--){
          const p = this.powerUps[i];
          p.x -= this.obstacleSpeed;
          // collect?
          if(!p.collected && this.isCollidingCircleRect(p, this.rocket)){
            p.collected = true;
            this.powerUps.splice(i,1);
            this.activateShield(5000); // 5 seconds
            this.playPowerUpSound();
          } else if(p.x + p.size < -50){
            this.powerUps.splice(i,1);
          }
        }

        // shield timeout
        if(this.shieldActive && Date.now() > this.shieldEndAt){
          this.shieldActive = false;
          this.shieldTimerEl.style.display = 'none';
        } else if(this.shieldActive){
          const left = Math.max(0, (this.shieldEndAt - Date.now())/1000);
          this.shieldTimerEl.style.display = 'block';
          this.shieldTimerEl.textContent = `Shield: ${left.toFixed(1)}s`;
        }

        // collision checks
        this.checkCollisions();
      }

      // ---------- Collisions ----------
      isCollidingCircleRect(circle, rect){
        // circle rect approximate: distance between circle center and rect center
        const cx = circle.x;
        const cy = circle.y;
        const rx = rect.x + rect.width/2;
        const ry = rect.y + rect.height/2;
        const dx = cx - rx;
        const dy = cy - ry;
        const dist = Math.sqrt(dx*dx + dy*dy);
        return dist < (rect.width/2 + circle.size/2)*0.9;
      }

      checkCollisions(){
        // top/bottom bounds
        if(this.rocket.y + this.rocket.height > this.canvas.height || this.rocket.y < 0){
          if(!this.shieldActive) { this.gameOver(); return; }
          // if shield active, clamp rocket inside bounds instead of game over
          this.rocket.y = Math.max(0, Math.min(this.rocket.y, this.canvas.height - this.rocket.height));
          this.rocket.velocity = 1.0;
        }

        // obstacle collisions
        for(let i=this.obstacles.length-1;i>=0;i--){
          const o = this.obstacles[i];
          const rocketCenterX = this.rocket.x + this.rocket.width/2;
          const rocketCenterY = this.rocket.y + this.rocket.height/2;
          const obstacleCenterX = o.x + o.width/2;
          const obstacleCenterY = o.y + o.height/2;
          const dx = rocketCenterX - obstacleCenterX;
          const dy = rocketCenterY - obstacleCenterY;
          const distance = Math.sqrt(dx*dx + dy*dy);

          if(distance < (this.rocket.width/2 + o.width/2) * 0.78){
            if(!this.shieldActive){
              this.gameOver();
              return;
            } else {
              // while shielded, remove the obstacle and give small score bump
              this.obstacles.splice(i,1);
              this.score += 1;
              this.updateScoreDisplay();
              // small tone to indicate hit while shielded
              this.playTone(400,0.06,'triangle');
            }
          }
        }
      }

      // ---------- Shield ----------
      activateShield(durationMs = 5000){
        this.shieldActive = true;
        this.shieldEndAt = Date.now() + durationMs;
      }

      // ---------- Drawing ----------
      draw(){
        const ctx = this.ctx;
        ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        this.drawSpaceBackground();
        this.drawBackgroundStars();
        this.drawPowerUps();
        this.drawObstacles();
        this.drawRocket();
        if(this.rocket.velocity < -1) this.drawThrusterEffect();
      }

      drawSpaceBackground(){
        const g = this.ctx.createLinearGradient(0,0,this.canvas.width,this.canvas.height);
        g.addColorStop(0,'#071023'); g.addColorStop(1,'#020114');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
      }

      drawBackgroundStars(){
        for(const s of this.backgroundStars){
          const a = Math.abs(Math.sin((this.frameCount*0.03) + s.pulse))*0.8 + 0.2;
          this.ctx.fillStyle = `rgba(255,255,255,${a})`;
          this.ctx.beginPath();
          this.ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
          this.ctx.fill();
        }
      }

      drawPowerUps(){
        for(const p of this.powerUps){
          this.drawStar(p.x, p.y, p.size/2, 5);
          // glow
          const g = this.ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.size*1.2);
          g.addColorStop(0, 'rgba(255,215,0,0.85)');
          g.addColorStop(1, 'rgba(255,165,0,0)');
          this.ctx.fillStyle = g;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size*0.9, 0, Math.PI*2);
          this.ctx.fill();
        }
      }

      drawStar(cx,cy,outerRadius, points=5){
        // draw a filled 5-pointed star
        const ctx = this.ctx;
        const inner = outerRadius * 0.5;
        ctx.save();
        ctx.beginPath();
        for(let i=0;i<points*2;i++){
          const r = (i%2===0) ? outerRadius : inner;
          const a = (Math.PI / points) * i;
          const x = cx + Math.cos(a - Math.PI/2) * r;
          const y = cy + Math.sin(a - Math.PI/2) * r;
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.strokeStyle = '#FFB84D';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      drawObstacles(){
        for(const o of this.obstacles){
          this.ctx.save();
          const cx = o.x + o.width/2, cy = o.y + o.height/2;
          this.ctx.translate(cx, cy);
          this.ctx.rotate(o.rotation);
          // meteor style
          this.ctx.fillStyle = '#8B4513';
          this.ctx.beginPath();
          this.ctx.arc(0,0,o.width/2,0,Math.PI*2);
          this.ctx.fill();
          // hot spot
          this.ctx.fillStyle = '#FF6A00';
          this.ctx.beginPath();
          this.ctx.arc(-o.width*0.18, -o.height*0.18, o.width*0.28, 0, Math.PI*2);
          this.ctx.fill();
          this.ctx.restore();
        }
      }

      drawRocket(){
        const ctx = this.ctx;
        const centerX = this.rocket.x + this.rocket.width/2;
        const centerY = this.rocket.y + this.rocket.height/2;

        ctx.save();
        ctx.translate(centerX, centerY);

        // Shield glow if active
        if(this.shieldActive){
          const left = (this.shieldEndAt - Date.now())/1000;
          const t = Math.max(0, left);
          const alpha = 0.4 + 0.4*Math.sin(Date.now()*0.01);
          const grad = ctx.createRadialGradient(0,0,16, 0,0,60);
          grad.addColorStop(0, `rgba(0,255,255,${alpha})`);
          grad.addColorStop(0.6, 'rgba(0,200,200,0.12)');
          grad.addColorStop(1, 'rgba(0,200,200,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0,0,60,0,Math.PI*2);
          ctx.fill();
          // thin ring
          ctx.strokeStyle = `rgba(0,255,255,${0.6})`;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0,0,44,0,Math.PI*2);
          ctx.stroke();
        }

        // Rocket body (ellipse)
        ctx.fillStyle = '#C0C0C0';
        ctx.beginPath();
        ctx.ellipse(0,0,25,18,0,0,Math.PI*2);
        ctx.fill();

        // Nose cone
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(15, -10);
        ctx.lineTo(15, 10);
        ctx.closePath();
        ctx.fill();

        // Fins
        ctx.fillStyle = '#FF6347';
        ctx.beginPath();
        ctx.moveTo(-15,-15); ctx.lineTo(-25,-25); ctx.lineTo(-25,-10); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-15,15); ctx.lineTo(-25,25); ctx.lineTo(-25,10); ctx.closePath(); ctx.fill();

        // Window
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath(); ctx.arc(5,0,8,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }

      drawThrusterEffect(){
        const ctx = this.ctx;
        const centerX = this.rocket.x;
        const centerY = this.rocket.y + this.rocket.height/2;
        ctx.save();
        ctx.translate(centerX, centerY);

        const flameLength = Math.min(60, Math.abs(this.rocket.velocity) * 6 + 10);
        const grad = ctx.createLinearGradient(0,0,-flameLength,0);
        grad.addColorStop(0,'#FF4500'); grad.addColorStop(0.5,'#FFD700'); grad.addColorStop(1,'#FF8C00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0,-8); ctx.lineTo(0,8); ctx.lineTo(-flameLength,4); ctx.lineTo(-flameLength,-4); ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFF66';
        ctx.beginPath();
        ctx.moveTo(0,-4); ctx.lineTo(0,4); ctx.lineTo(-flameLength*0.7,2); ctx.lineTo(-flameLength*0.7,-2); ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // ---------- UI helpers ----------
      updateScoreDisplay(){ this.scoreEl.textContent = `Score: ${this.score}`; }
      updateHighScoreDisplay(){ this.highScoreEl.textContent = `High Score: ${this.highScore}`; }
      loadHighScore(){ try { return Number(localStorage.getItem('rocket_highscore') || 0); } catch(e){ return 0; } }
      saveHighScore(){ try { localStorage.setItem('rocket_highscore', String(this.highScore)); } catch(e){} }

      gameOver(){
        this.gameState = 'gameOver';
        this.playCrashSound();

        let isNew = false;
        if(this.score > this.highScore){
          this.highScore = this.score;
          this.saveHighScore();
          isNew = true;
        }
        this.finalScoreEl.textContent = `Score: ${this.score}`;
        this.newHighEl.style.display = isNew ? 'block' : 'none';
        this.gameOverScreen.style.display = 'block';
      }

      // ---------- Main loop ----------
      gameLoop(){
        this.update();
        this.draw();
        requestAnimationFrame(()=>this.gameLoop());
      }

      // helper tone (public)
      playTone(freq,d=0.08,t='sine'){ if(this.audioCtx) this.playTone = this.playTone || (()=>{}); /*noop for safety*/ /*not used here*/ }
    }

    // init
    let game = null;
    window.addEventListener('load', ()=>{
      game = new SpaceRocketGame();
    });

  })();
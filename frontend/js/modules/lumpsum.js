(function () {
  function q(id) { return document.getElementById(id); }
  function formatINR(v){ if(!isFinite(v)) return "—"; return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(v));}
  function formatCompactINR(v){ if(!isFinite(v)) return "—"; var a=Math.abs(v); if(a>=1e7)return "₹"+(v/1e7).toFixed(v>=1e8?0:1)+" Cr"; if(a>=1e5)return "₹"+(v/1e5).toFixed(v>=1e6?0:1)+" L"; return formatINR(v);}
  function setupCanvas(c){ if(!c) return null; var r=c.getBoundingClientRect(),d=window.devicePixelRatio||1,w=Math.max(280,Math.floor(r.width)),h=Math.max(220,Math.floor(r.height||260)); c.width=w*d; c.height=h*d; var x=c.getContext("2d"); x.setTransform(d,0,0,d,0,0); return {ctx:x,width:w,height:h};}
  function rr(ctx,x,y,w,h,r){var n=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+n,y);ctx.lineTo(x+w-n,y);ctx.quadraticCurveTo(x+w,y,x+w,y+n);ctx.lineTo(x+w,y+h-n);ctx.quadraticCurveTo(x+w,y+h,x+w-n,y+h);ctx.lineTo(x+n,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-n);ctx.lineTo(x,y+n);ctx.quadraticCurveTo(x,y,x+n,y);ctx.closePath();}
  function calc(amount,cagr,years){var rows=[],cur=amount;for(var y=1;y<=years;y++){var opening=cur,closing=amount*Math.pow(1+cagr/100,y),growth=closing-opening;rows.push({year:y,opening:opening,growth:growth,closing:closing,invested:amount,gain:closing-amount,multiple:amount>0?closing/amount:0});cur=closing;}return rows;}
  function drawLine(canvas,rows){var d=setupCanvas(canvas); if(!d||!rows.length) return; var c=d.ctx,w=d.width,h=d.height; c.clearRect(0,0,w,h); var pL=w<420?44:58,pR=14,pT=18,pB=36,pW=w-pL-pR,pH=h-pT-pB,max=Math.max.apply(null,rows.map(function(r){return Math.max(r.invested,r.closing);}))*1.08; if(max<=0)max=1;
    function x(i){return pL+(rows.length===1?0:i*pW/(rows.length-1));} function y(v){return pT+pH-(v/max)*pH;}
    function line(k,col,lw){c.beginPath(); rows.forEach(function(r,i){var xx=x(i),yy=y(r[k]); if(i===0)c.moveTo(xx,yy); else {var px=x(i-1),py=y(rows[i-1][k]),mx=(px+xx)/2; c.bezierCurveTo(mx,py,mx,yy,xx,yy);} }); c.strokeStyle=col; c.lineWidth=lw; c.lineCap="round"; c.lineJoin="round"; c.stroke();}
    c.strokeStyle="rgba(255,255,255,0.08)"; c.lineWidth=1; c.fillStyle="rgba(203,213,232,0.72)"; c.font="10px Inter, Arial";
    for(var g=0;g<=4;g++){var yy=pT+(pH*g/4),val=max*(1-g/4); c.beginPath(); c.moveTo(pL,yy); c.lineTo(w-pR,yy); c.stroke(); c.fillText(formatCompactINR(val),4,yy+3);}
    line("invested","#4C8DFF",2.2); line("closing","#D4AF37",3);
    canvas._pts=rows.map(function(r,i){return {x:x(i),yInvested:y(r.invested),yClosing:y(r.closing),year:r.year,invested:r.invested,closing:r.closing,gain:r.gain,multiple:r.multiple};});
    canvas._rows=rows;
  }
  function drawBars(canvas,rows){var d=setupCanvas(canvas); if(!d||!rows.length)return; var c=d.ctx,w=d.width,h=d.height; c.clearRect(0,0,w,h); var pL=w<420?44:58,pR=14,pT=18,pB=36,pW=w-pL-pR,pH=h-pT-pB,max=Math.max.apply(null,rows.map(function(r){return r.closing;}))*1.08; if(max<=0)max=1; var step=Math.max(1,Math.ceil(rows.length/(w<420?8:14))),vrows=rows.filter(function(r,i){return i===0||i===rows.length-1||i%step===0;}),gap=6,bw=Math.max(8,(pW-gap*(vrows.length-1))/vrows.length);
    vrows.forEach(function(r,i){var x=pL+i*(bw+gap),inv=(r.invested/max)*pH,g=(Math.max(r.gain,0)/max)*pH,base=pT+pH; c.fillStyle="#4C8DFF"; rr(c,x,base-inv,bw,inv,5); c.fill(); c.fillStyle="#D4AF37"; rr(c,x,base-inv-g,bw,g,5); c.fill();});
    canvas._bars=vrows.map(function(r,i){return {x:pL+i*(bw+gap),w:bw,year:r.year,invested:r.invested,gain:r.gain,closing:r.closing,multiple:r.multiple};});
    canvas._rows=rows;
  }
  function tip(tooltip,canvas,mode,e){if(!tooltip||!canvas)return; var r=canvas.getBoundingClientRect(),x=e.clientX-r.left,d=null; if(mode==="line"&&canvas._pts){canvas._pts.forEach(function(p){if(!d||Math.abs(p.x-x)<Math.abs(d.x-x))d=p;});} if(mode==="bar"&&canvas._bars){canvas._bars.forEach(function(b){if(x>=b.x&&x<=b.x+b.w)d=b;});} if(!d){tooltip.style.display="none";return;}
    if(canvas._rows){
      if(mode==="line") drawLine(canvas, canvas._rows);
      else drawBars(canvas, canvas._rows);
    }
    var ctx=canvas.getContext("2d");
    var w=canvas.width/(window.devicePixelRatio||1);
    var h=canvas.height/(window.devicePixelRatio||1);
    if(mode==="line"){
      ctx.strokeStyle="rgba(255,255,255,0.2)"; ctx.lineWidth=1; ctx.beginPath();
      if(ctx.setLineDash) ctx.setLineDash([3,3]);
      ctx.moveTo(d.x,18); ctx.lineTo(d.x,h-36); ctx.stroke();
      if(ctx.setLineDash) ctx.setLineDash([]);
      
      ctx.fillStyle="#4C8DFF"; ctx.beginPath(); ctx.arc(d.x,d.yInvested,4.5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle="rgba(255,255,255,0.4)"; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle="#D4AF37"; ctx.beginPath(); ctx.arc(d.x,d.yClosing,5.5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle="rgba(255,255,255,0.4)"; ctx.lineWidth=1.5; ctx.stroke();
    } else {
      ctx.fillStyle="rgba(255,255,255,0.08)";
      ctx.fillRect(d.x-2,18,d.w+4,h-18-36);
    }
    tooltip.innerHTML="<b>Year "+d.year+"</b><br>Invested: "+formatINR(d.invested)+"<br>Value: "+formatINR(d.closing)+"<br>Gain: "+formatINR(d.gain)+"<br>Multiple: "+d.multiple.toFixed(2)+"x"; tooltip.style.display="block"; tooltip.style.left=Math.min(e.clientX+12,window.innerWidth-250)+"px"; tooltip.style.top=Math.max(e.clientY-18,10)+"px";}
  document.addEventListener("DOMContentLoaded", function(){
    var amount=q("ivLumpsumAmount"),cagr=q("ivLumpsumCagr"),years=q("ivLumpsumYears");
    var amountSlider=q("ivLumpsumAmountSlider"),cagrSlider=q("ivLumpsumCagrSlider"),yearsSlider=q("ivLumpsumYearsSlider");
    var calcBtn=q("ivLumpsumCalculate"),resetBtn=q("ivLumpsumReset"),err=q("ivLumpsumError");
    var invested=q("ivLumpsumInvested"),fv=q("ivLumpsumFutureValue"),gain=q("ivLumpsumGain"),mul=q("ivLumpsumMultiple");
    var tb=q("ivLumpsumTableBody"),line=q("ivLumpsumLineChart"),bars=q("ivLumpsumStackedChart"),tt=q("ivLumpsumTooltip");
    
    // Layout and reveal elements
    var layoutWrapper=q("ivLumpsumLayoutWrapper");
    var resultsReveal=q("ivLumpsumResultsReveal");
    var chartsReveal=q("ivLumpsumChartsReveal");
    var tableReveal=q("ivLumpsumTableReveal");
    var tableCard=q("ivLumpsumTableCard");

    if(!calcBtn) return;
    function show(m){err.textContent=m; err.style.display=m?"block":"none";}

    function run(){
      var a=Number(amount.value),c=Number(cagr.value),y=Number(years.value);
      if(!a||a<=0)return show("Please enter a valid initial investment amount greater than 0.");
      if(!isFinite(c)||c<0)return show("Please enter a valid expected CAGR. It cannot be negative.");
      if(!y||y<=0||y>80||Math.floor(y)!==y)return show("Please enter a valid investment period in whole years between 1 and 80.");
      show("");
      
      var rows=calc(a,c,y),last=rows[rows.length-1];
      invested.textContent=formatINR(a);
      fv.textContent=formatINR(last.closing);
      gain.textContent=formatINR(last.gain);
      mul.textContent=last.multiple.toFixed(2)+"x";
      
      tb.innerHTML=rows.map(function(r){
        return "<tr><td>"+r.year+"</td><td>"+formatINR(r.opening)+"</td><td>"+formatINR(r.growth)+"</td><td>"+formatINR(r.closing)+"</td></tr>";
      }).join("");

      // Adjust layout
      if(layoutWrapper) layoutWrapper.classList.add("calculated");
      if(resultsReveal) resultsReveal.style.display="block";
      if(chartsReveal) chartsReveal.style.display="block";
      if(tableReveal) tableReveal.style.display="block";

      // Draw the charts
      drawLine(line,rows);
      drawBars(bars,rows);

      // Trigger animations
      requestAnimationFrame(function () {
        [resultsReveal, chartsReveal, tableReveal].forEach(function (el) {
          if (el) el.classList.add("show");
        });
      });
    }

    function reset(){
      amount.value="1000000"; if(amountSlider) amountSlider.value="1000000";
      cagr.value="12"; if(cagrSlider) cagrSlider.value="12";
      years.value="15"; if(yearsSlider) yearsSlider.value="15";
      
      show("");
      invested.textContent=fv.textContent=gain.textContent=mul.textContent="—";
      tb.innerHTML="<tr><td colspan=\"4\">Enter investment details and click Calculate Lumpsum.</td></tr>";
      [line,bars].forEach(function(cv){var d=setupCanvas(cv); if(d)d.ctx.clearRect(0,0,d.width,d.height);});
      if(tt)tt.style.display="none";

      // Revert layout
      if (layoutWrapper) layoutWrapper.classList.remove("calculated");
      [resultsReveal, chartsReveal, tableReveal].forEach(function (el) {
        if (el) {
          el.classList.remove("show");
          el.style.display="none";
        }
      });
      if (tableCard) tableCard.classList.add("collapsed");
    }

    // Set defaults from sliders on load
    if (amount && amountSlider) amount.value = amountSlider.value;
    if (cagr && cagrSlider) cagr.value = cagrSlider.value;
    if (years && yearsSlider) years.value = yearsSlider.value;

    // Bidirectional Slider Sync
    function setupSync(inputEl, sliderEl) {
      if (!inputEl || !sliderEl) return;
      
      inputEl.addEventListener("input", function () {
        var val = Number(inputEl.value);
        var min = Number(sliderEl.min);
        var max = Number(sliderEl.max);
        if (isFinite(val) && val >= min && val <= max) {
          sliderEl.value = val;
        }
        if (layoutWrapper && layoutWrapper.classList.contains("calculated")) {
          run();
        }
      });

      sliderEl.addEventListener("input", function () {
        inputEl.value = sliderEl.value;
        if (layoutWrapper && layoutWrapper.classList.contains("calculated")) {
          run();
        }
      });
    }

    setupSync(amount, amountSlider);
    setupSync(cagr, cagrSlider);
    setupSync(years, yearsSlider);

    // Collapsible Card System for Year-wise table
    if (tableCard) {
      var tableHeader = tableCard.querySelector(".iv-collapse-header");
      if (tableHeader) {
        tableHeader.addEventListener("click", function () {
          tableCard.classList.toggle("collapsed");
        });
      }
    }

    calcBtn.addEventListener("click",run);
    if(resetBtn)resetBtn.addEventListener("click",reset);
    [amount,cagr,years].forEach(function(i){i&&i.addEventListener("keydown",function(e){if(e.key==="Enter")run();});});
    if(line){line.addEventListener("mousemove",function(e){tip(tt,line,"line",e);}); line.addEventListener("mouseleave",function(){tt.style.display="none"; if(line._rows) drawLine(line, line._rows);});}
    if(bars){bars.addEventListener("mousemove",function(e){tip(tt,bars,"bar",e);}); bars.addEventListener("mouseleave",function(){tt.style.display="none"; if(bars._rows) drawBars(bars, bars._rows);});}
  });
})();

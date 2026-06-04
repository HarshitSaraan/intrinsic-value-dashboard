(function () {
  function q(id){return document.getElementById(id);}
  function formatINR(v){ if(!isFinite(v)) return "—"; return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(v));}
  function formatCompactINR(v){ if(!isFinite(v)) return "—"; var a=Math.abs(v); if(a>=1e7)return "₹"+(v/1e7).toFixed(v>=1e8?0:1)+" Cr"; if(a>=1e5)return "₹"+(v/1e5).toFixed(v>=1e6?0:1)+" L"; return formatINR(v);}
  function setupCanvas(c){ if(!c) return null; var r=c.getBoundingClientRect(),d=window.devicePixelRatio||1,w=Math.max(280,Math.floor(r.width)),h=Math.max(220,Math.floor(r.height||240)); c.width=w*d; c.height=h*d; var x=c.getContext("2d"); x.setTransform(d,0,0,d,0,0); return {ctx:x,width:w,height:h};}
  function badge(fv){var cr=1e7; if(fv<1*cr)return{label:"Poor",className:"poor",icon:"🛡"}; if(fv<=5*cr)return{label:"Middle Class",className:"middle",icon:"💼"}; if(fv<=25*cr)return{label:"Upper Middle",className:"upper",icon:"🎫"}; if(fv<=100*cr)return{label:"Rich",className:"rich",icon:"◆"}; if(fv<=5000*cr)return{label:"Ultra Rich",className:"ultra",icon:"👑"}; return{label:"Top 500 in India",className:"top",icon:"🏆"};}
  function interp(label){ if(label==="Poor"||label==="Middle Class") return "Consistent savings and disciplined investing can significantly improve outcomes."; if(label==="Upper Middle") return "You are on the right path. Stay disciplined and avoid lifestyle inflation."; if(label==="Rich") return "You are doing well. Continue focusing on long-term compounding."; if(label==="Ultra Rich") return "You are exceptionally well positioned under the GAWP framework."; if(label==="Top 500 in India") return "Extraordinary projection under this framework. Stay grounded and responsible."; return "Educational age-adjusted wealth benchmark.";}
  function calc(age,capital,cagr){ var yearsLeft=Math.max(0,80-age),future=age<80?capital*Math.pow(1+cagr/100,yearsLeft):capital,b=badge(future); return {age:age,capital:capital,cagr:cagr,yearsLeft:yearsLeft,futureValue:future,badge:b,interpretation:interp(b.label)};}
  function journey(result){ var cycle=[0.25,0.25,-0.10,-0.20,0.40,0.15,-0.08,0.32,-0.15,0.22],points=[],years=Math.max(0,result.yearsLeft); if(years===0) return [{year:result.age,value:result.futureValue}]; var raw=result.capital; points.push({year:result.age,value:result.capital}); for(var i=1;i<=years;i++){raw=raw*(1+cycle[(i-1)%cycle.length]); points.push({year:result.age+i,raw:raw});} var rawFinal=points[points.length-1].raw||result.capital||1,finalRatio=result.capital>0?result.futureValue/result.capital:1,rawRatio=result.capital>0?rawFinal/result.capital:1,scaler=rawRatio>0?finalRatio/rawRatio:1; for(var j=1;j<points.length;j++){var p=j/years,adj=Math.pow(scaler,p); points[j].value=points[j].raw*adj;} points[points.length-1].value=result.futureValue; return points;}
  function draw(canvas,result){ var d=setupCanvas(canvas); if(!d||!result) return; var c=d.ctx,w=d.width,h=d.height; c.clearRect(0,0,w,h); var pts=journey(result),pL=w<420?44:58,pR=16,pT=18,pB=36,pW=w-pL-pR,pH=h-pT-pB,max=Math.max.apply(null,pts.map(function(p){return p.value;}).concat([result.capital,result.futureValue]))*1.12; if(max<=0)max=1;
    function x(i){return pL+(pts.length===1?0:i*pW/(pts.length-1));} function y(v){return pT+pH-(v/max)*pH;}
    c.strokeStyle="rgba(255,255,255,0.08)"; c.lineWidth=1; c.fillStyle="rgba(203,213,232,0.72)"; c.font="10px Inter, Arial";
    for(var g=0;g<=4;g++){var yy=pT+(pH*g/4),val=max*(1-g/4); c.beginPath(); c.moveTo(pL,yy); c.lineTo(w-pR,yy); c.stroke(); c.fillText(formatCompactINR(val),4,yy+3);}
    c.beginPath(); pts.forEach(function(p,i){var xx=x(i),yy=y(p.value); if(i===0)c.moveTo(xx,yy); else {var px=x(i-1),py=y(pts[i-1].value),mx=(px+xx)/2; c.bezierCurveTo(mx,py,mx,yy,xx,yy);} }); c.strokeStyle="#D4AF37"; c.lineWidth=3; c.lineCap="round"; c.lineJoin="round"; c.stroke();
    c.fillStyle="#4C8DFF"; c.beginPath(); c.arc(x(0),y(result.capital),4.5,0,Math.PI*2); c.fill();
    c.fillStyle="#D4AF37"; c.beginPath(); c.arc(x(pts.length-1),y(result.futureValue),5,0,Math.PI*2); c.fill();
    canvas._bars=pts.map(function(p,i){return{x:x(i),yValue:y(p.value),w:12,label:"Age "+p.year,value:p.value};});
    canvas._result=result;
  }
  document.addEventListener("DOMContentLoaded", function(){
    var age=q("ivGawpAge"),cap=q("ivGawpCapital"),cagr=q("ivGawpCagr"),adj=q("ivGawpAdjustCagr");
    var ageSlider=q("ivGawpAgeSlider"),capSlider=q("ivGawpCapitalSlider"),cagrSlider=q("ivGawpCagrSlider");
    var calcBtn=q("ivGawpCalculate"),resetBtn=q("ivGawpReset"),err=q("ivGawpError");
    var ca=q("ivGawpCurrentAge"),cc=q("ivGawpCurrentCapital"),yl=q("ivGawpYearsLeft"),fv=q("ivGawpFutureValue");
    var badgeEl=q("ivGawpBadge"),it=q("ivGawpInterpretation"),chart=q("ivGawpProjectionChart"),tip=q("ivGawpTooltip");
    
    // Layout and reveal elements
    var layoutWrapper=q("ivGawpLayoutWrapper");
    var resultsReveal=q("ivGawpResultsReveal");
    var visualsReveal=q("ivGawpVisualsReveal");
    var extraReveal=q("ivGawpExtraReveal");

    if(!calcBtn) return;
    function show(m){err.textContent=m; err.style.display=m?"block":"none";}

    function run(){
      var a=Number(age.value),cp=Number(cap.value),cg=15;
      if(adj&&adj.checked) cg=Number(cagr.value);
      if(!a||a<=0||!isFinite(a)) return show("Please enter a valid age greater than 0.");
      if(Math.floor(a)!==a) return show("Please enter age in completed whole years.");
      if(!isFinite(cp)||cp<0||cap.value==="") return show("Please enter valid investable capital greater than or equal to 0.");
      if(!isFinite(cg)||cg<12||cg>17) return show("Please enter CAGR between 12% and 17%.");
      show("");
      
      var r=calc(a,cp,cg);
      ca.textContent=r.age+" years";
      cc.textContent=formatINR(r.capital);
      yl.textContent=r.yearsLeft+" years";
      fv.textContent=formatINR(r.futureValue);
      badgeEl.innerHTML="<span class=\"iv-gawp-badge-icon\">"+r.badge.icon+"</span>"+r.badge.label;
      badgeEl.className="iv-gawp-badge "+r.badge.className;
      it.textContent=r.interpretation;

      // Adjust layout grid and display cards
      if(layoutWrapper) layoutWrapper.classList.add("calculated");
      if(resultsReveal) resultsReveal.style.display="block";
      if(visualsReveal) visualsReveal.style.display="block";
      if(extraReveal) extraReveal.style.display="block";

      // Draw the projection chart now that the canvas is visible
      draw(chart,r);

      // Trigger animations
      requestAnimationFrame(function () {
        [resultsReveal, visualsReveal, extraReveal].forEach(function (el) {
          if (el) el.classList.add("show");
        });
      });
    }

    function reset(){
      age.value="30"; if(ageSlider) ageSlider.value="30";
      cap.value="1000000"; if(capSlider) capSlider.value="1000000";
      cagr.value="15"; if(cagrSlider) cagrSlider.value="15";
      cagr.disabled=true;
      if(cagrSlider) cagrSlider.disabled=true;
      if(adj) adj.checked=false;

      show("");
      ca.textContent=cc.textContent=yl.textContent=fv.textContent="—";
      badgeEl.innerHTML="<span class=\"iv-gawp-badge-icon\">◆</span>Badge pending";
      badgeEl.className="iv-gawp-badge";
      it.textContent="Enter age and investable capital to calculate your GAWP badge.";
      
      var d=setupCanvas(chart);
      if(d)d.ctx.clearRect(0,0,d.width,d.height);
      if(tip)tip.style.display="none";

      // Revert layout
      if(layoutWrapper) layoutWrapper.classList.remove("calculated");
      [resultsReveal, visualsReveal, extraReveal].forEach(function (el) {
        if (el) {
          el.classList.remove("show");
          el.style.display="none";
        }
      });
    }

    // Set defaults from sliders on load
    if (age && ageSlider) age.value = ageSlider.value;
    if (cap && capSlider) cap.value = capSlider.value;
    if (cagr && cagrSlider) cagr.value = cagrSlider.value;

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

    setupSync(age, ageSlider);
    setupSync(cap, capSlider);
    setupSync(cagr, cagrSlider);

    calcBtn.addEventListener("click",run);
    if(resetBtn)resetBtn.addEventListener("click",reset);
    [age,cap,cagr].forEach(function(i){i&&i.addEventListener("keydown",function(e){if(e.key==="Enter")run();});});
    
    if(adj&&cagr){
      adj.addEventListener("change",function(){
        cagr.disabled=!adj.checked;
        if(cagrSlider) cagrSlider.disabled=!adj.checked;
        if(!adj.checked) {
          cagr.value="15";
          if(cagrSlider) cagrSlider.value="15";
        }
        if (layoutWrapper && layoutWrapper.classList.contains("calculated")) {
          run();
        }
      });
    }

    if(chart){
      function onHover(clientX, clientY) {
        if(!tip||!chart._bars)return;
        var r=chart.getBoundingClientRect(),x=clientX-r.left,d=null;
        chart._bars.forEach(function(b){if(!d||Math.abs(b.x-x)<Math.abs(d.x-x))d=b;});
        if(!d){tip.style.display="none";return;}
        if(chart._result) draw(chart, chart._result);
        var ctx=chart.getContext("2d");
        var w=chart.width/(window.devicePixelRatio||1);
        var h=chart.height/(window.devicePixelRatio||1);
        ctx.strokeStyle="rgba(255,255,255,0.2)"; ctx.lineWidth=1; ctx.beginPath();
        if(ctx.setLineDash) ctx.setLineDash([3,3]);
        ctx.moveTo(d.x,18); ctx.lineTo(d.x,h-36); ctx.stroke();
        if(ctx.setLineDash) ctx.setLineDash([]);
        ctx.fillStyle="#D4AF37"; ctx.beginPath(); ctx.arc(d.x,d.yValue,5.5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle="rgba(255,255,255,0.4)"; ctx.lineWidth=1.5; ctx.stroke();
        tip.innerHTML="<b>"+d.label+"</b><br>"+formatINR(d.value);
        tip.style.display="block";
        var ttW = tip.offsetWidth || 250;
        var ttH = tip.offsetHeight || 80;
        tip.style.left = Math.max(10, Math.min(clientX - ttW / 2, window.innerWidth - ttW - 10)) + "px";
        tip.style.top = Math.max(10, clientY - ttH - 24) + "px";
      }

      function onLeave() {
        if(tip)tip.style.display="none";
        if(chart._result) draw(chart, chart._result);
      }

      chart.addEventListener("mousemove", function(e) { onHover(e.clientX, e.clientY); });
      chart.addEventListener("mouseleave", onLeave);

      chart.addEventListener("touchstart", function (e) {
        if (e.touches.length) {
          var t = e.touches[0];
          onHover(t.clientX, t.clientY);
        }
      }, { passive: true });

      chart.addEventListener("touchmove", function (e) {
        if (e.touches.length) {
          if (e.cancelable) e.preventDefault();
          var t = e.touches[0];
          onHover(t.clientX, t.clientY);
        }
      }, { passive: false });

      chart.addEventListener("touchend", onLeave);
    }



    // Toggle FAQ Section Collapse state
    var faqSectionCard = q("ivFaqSectionCard");
    var faqSectionHeader = q("ivFaqSectionHeader");
    if (faqSectionCard && faqSectionHeader) {
      faqSectionHeader.addEventListener("click", function() {
        faqSectionCard.classList.toggle("collapsed");
      });
    }

    // Toggle Individual FAQ item collapse state
    var faqQuestions = document.querySelectorAll(".iv-faq-question");
    faqQuestions.forEach(function(question) {
      question.addEventListener("click", function() {
        var item = question.closest(".iv-faq-item");
        if (item) {
          item.classList.toggle("collapsed");
        }
      });
    });
  });
})();

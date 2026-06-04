(function () {
  function q(id){return document.getElementById(id);}
  function formatINR(v){if(!isFinite(v))return"—";return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Math.round(v));}
  function formatCompactINR(v){if(!isFinite(v))return"—";var a=Math.abs(v);if(a>=1e7)return"₹"+(v/1e7).toFixed(v>=1e8?0:1)+" Cr";if(a>=1e5)return"₹"+(v/1e5).toFixed(v>=1e6?0:1)+" L";return formatINR(v);}
  function setupCanvas(c){if(!c)return null;var r=c.getBoundingClientRect(),d=window.devicePixelRatio||1,w=Math.max(280,Math.floor(r.width)),h=Math.max(220,Math.floor(r.height||260));c.width=w*d;c.height=h*d;var x=c.getContext("2d");x.setTransform(d,0,0,d,0,0);return{ctx:x,width:w,height:h};}
  function rr(ctx,x,y,w,h,r){var n=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+n,y);ctx.lineTo(x+w-n,y);ctx.quadraticCurveTo(x+w,y,x+w,y+n);ctx.lineTo(x+w,y+h-n);ctx.quadraticCurveTo(x+w,y+h,x+w-n,y+h);ctx.lineTo(x+n,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-n);ctx.lineTo(x,y+n);ctx.quadraticCurveTo(x,y,x+n,y);ctx.closePath();}
  function today(){var n=new Date(),o=n.getTimezoneOffset()*60000;return new Date(n.getTime()-o).toISOString().slice(0,10);}
  function createRow(d,i,w){var tr=document.createElement("tr");tr.className="iv-xirr-cashflow-row";tr.innerHTML='<td><input class="iv-xirr-table-input iv-xirr-date" type="date"></td><td><input class="iv-xirr-table-input iv-xirr-invested" type="number" min="0"></td><td><input class="iv-xirr-table-input iv-xirr-withdrawn" type="number" min="0"></td><td><button class="iv-xirr-delete" type="button">Delete</button></td>'; if(d)tr.querySelector(".iv-xirr-date").value=d; if(i!==undefined)tr.querySelector(".iv-xirr-invested").value=i; if(w!==undefined)tr.querySelector(".iv-xirr-withdrawn").value=w; return tr;}
  function bindDelete(row,body){var b=row.querySelector(".iv-xirr-delete"); if(!b||b._ivBound)return; b._ivBound=true; b.addEventListener("click",function(){var rows=body.querySelectorAll(".iv-xirr-cashflow-row"); if(rows.length<=1){row.querySelectorAll("input").forEach(function(i){i.value="";});}else row.remove();});}
  function npv(rate,cfs){var start=cfs[0].date; return cfs.reduce(function(sum,cf){var y=(cf.date-start)/(365.25*24*60*60*1000); return sum+cf.amount/Math.pow(1+rate,y);},0);}
  function calcRate(cfs){var low=-0.999999,high=10,nl=npv(low,cfs),nh=npv(high,cfs),k=0; while(nl*nh>0&&k<30){high=high*2+1;nh=npv(high,cfs);k++;} if(!isFinite(nl)||!isFinite(nh)||nl*nh>0) return null; for(var i=0;i<120;i++){var mid=(low+high)/2,nm=npv(mid,cfs); if(!isFinite(nm))return null; if(Math.abs(nm)<0.000001)return mid; if(nl*nm<=0){high=mid;nh=nm;}else{low=mid;nl=nm;}} return (low+high)/2;}
  function perf(x) {
    if (x < 8) {
      return {
        category: 'Extremely weak equity performance',
        message: 'Your equity performance is materially weak. You should urgently review your process, risk management and stock selection. Consider taking professional help before committing more capital.'
      };
    }
    if (x < 15) {
      return {
        category: 'Below-average equity performance',
        message: 'Your performance is below what a serious equity investor should aim for over the long term. Consider improving your framework or taking help from a qualified advisor or PMS manager.'
      };
    }
    if (x < 25) {
      return {
        category: 'Good equity performance',
        message: 'You are doing well. With better allocation discipline, risk control and professional guidance, this performance can potentially become stronger and more consistent.'
      };
    }
    return {
      category: 'Excellent equity performance',
      message: 'Fabulous performance. You appear to have a strong investing process. Continue doing what is working, but avoid overconfidence and keep tracking risk carefully.'
    };
  }
  function collect(body,current,vd){
    var rows=[].slice.call(body.querySelectorAll(".iv-xirr-cashflow-row")),cashflows=[],ti=0,tw=0,hasInv=false;
    for(var i=0;i<rows.length;i++){
      var r=rows[i],date=r.querySelector(".iv-xirr-date").value,ir=r.querySelector(".iv-xirr-invested").value,wr=r.querySelector(".iv-xirr-withdrawn").value,any=date||ir||wr;
      if(!any)continue;
      if(!date)return{error:"Dates are required for all filled cashflow rows."};
      var inv=ir===""?0:Number(ir),wd=wr===""?0:Number(wr);
      if(!isFinite(inv)||inv<0||!isFinite(wd)||wd<0)return{error:"Amounts must be non-negative. Please do not enter negative numbers."};
      if(inv===0&&wd===0)return{error:"Please enter invested capital or withdrawn capital for every filled row."};
      if(inv>0){cashflows.push({date:new Date(date+"T00:00:00"),amount:-inv,label:"Investment"});ti+=inv;hasInv=true;}
      if(wd>0){cashflows.push({date:new Date(date+"T00:00:00"),amount:wd,label:"Withdrawal"});tw+=wd;}
    }
    var ccRaw=current.value,cc=Number(ccRaw),v=vd.value;
    if(!hasInv)return{error:"At least one investment entry is required."};
    if(ccRaw===""||!isFinite(cc)||cc<0)return{error:"Current capital is required and must be non-negative."};
    if(!v)return{error:"Valuation date is required."};
    cashflows.push({date:new Date(v+"T00:00:00"),amount:cc,label:"Current Value"});
    var neg=cashflows.some(function(c){return c.amount<0;}),pos=cashflows.some(function(c){return c.amount>0;});
    if(!neg||!pos)return{error:"There must be at least one investment cashflow and one positive cashflow from withdrawal or current value."};
    cashflows.sort(function(a,b){return a.date-b.date;});
    return{cashflows:cashflows,totalInvested:ti,totalWithdrawn:tw,currentCapital:cc};
  }
  function drawJourney(canvas,pts){
    var d=setupCanvas(canvas);
    if(!d||!pts.length)return;
    var c=d.ctx,w=d.width,h=d.height,pL=w<420?44:58,pR=16,pT=18,pB=36,pW=w-pL-pR,pH=h-pT-pB,max=Math.max.apply(null,pts.map(function(p){return Math.max(p.deployed||0,p.value||0);}))*1.12;
    if(max<=0)max=1;
    var start=pts[0].date.getTime(),end=pts[pts.length-1].date.getTime();
    if(end===start)end=start+86400000;
    function x(dt){return pL+((dt.getTime()-start)/(end-start))*pW;}
    function y(v){return pT+pH-(v/max)*pH;}
    c.clearRect(0,0,w,h);
    c.strokeStyle="rgba(255,255,255,0.08)";
    c.fillStyle="rgba(203,213,232,0.72)";
    c.font="10px Inter, Arial";
    for(var g=0;g<=4;g++){
      var yy=pT+(pH*g/4),val=max*(1-g/4);
      c.beginPath();
      c.moveTo(pL,yy);
      c.lineTo(w-pR,yy);
      c.stroke();
      c.fillText(formatCompactINR(val),4,yy+3);
    }
    c.beginPath();
    pts.forEach(function(p,i){
      var xx=x(p.date),yy=y(p.deployed);
      if(i===0)c.moveTo(xx,yy);
      else c.lineTo(xx,yy);
    });
    c.strokeStyle="#4C8DFF";
    c.lineWidth=2.4;
    c.stroke();
    var f=pts[pts.length-1];
    c.fillStyle="#D4AF37";
    c.beginPath();
    c.arc(x(f.date),y(f.value),5,0,Math.PI*2);
    c.fill();
    canvas._pts=pts.map(function(p){return{x:x(p.date),yDeployed:y(p.deployed),yValue:y(p.value),date:p.date,deployed:p.deployed,value:p.value,label:p.label};});
    canvas._ptsData = pts;
  }
  function drawSummary(canvas,s){
    var d=setupCanvas(canvas);
    if(!d)return;
    var c=d.ctx,w=d.width,h=d.height,pL=w<420?44:58,pR=16,pT=18,pB=48,pW=w-pL-pR,pH=h-pT-pB,b=[{label:"Invested",value:s.totalInvested,color:"#4C8DFF"},{label:"Withdrawn",value:s.totalWithdrawn,color:"#77DD77"},{label:"Current",value:s.currentCapital,color:"#D4AF37"},{label:"Gain/Loss",value:s.absoluteGainLoss,color:s.absoluteGainLoss>=0?"#D4AF37":"#FF6B6B"}],max=Math.max.apply(null,b.map(function(v){return Math.abs(v.value);}))*1.15;
    if(max<=0)max=1;
    var gap=12,bw=Math.max(24,(pW-gap*(b.length-1))/b.length),base=pT+pH;
    c.clearRect(0,0,w,h);
    c.strokeStyle="rgba(255,255,255,0.08)";
    c.lineWidth=1;
    c.fillStyle="rgba(203,213,232,0.72)";
    c.font="10px Inter, Arial";
    for(var g=0;g<=4;g++){
      var yy=pT+(pH*g/4),val=max*(1-g/4);
      c.beginPath();
      c.moveTo(pL,yy);
      c.lineTo(w-pR,yy);
      c.stroke();
      c.fillText(formatCompactINR(val),4,yy+3);
    }
    b.forEach(function(v,i){
      var x=pL+i*(bw+gap),hh=(Math.abs(v.value)/max)*pH;
      c.fillStyle=v.color;
      rr(c,x,base-hh,bw,Math.max(2,hh),6);
      c.fill();
      c.fillStyle="rgba(203,213,232,0.82)";
      c.fillText(v.label,x,h-22);
    });
    canvas._bars=b.map(function(v,i){return{x:pL+i*(bw+gap),w:bw,label:v.label,value:v.value};});
    canvas._sData = s;
  }
  document.addEventListener("DOMContentLoaded",function(){
    var body=q("ivXirrCashflowBody"),add=q("ivXirrAddRow"),cc=q("ivXirrCurrentCapital"),vd=q("ivXirrValuationDate");
    var ccSlider=q("ivXirrCurrentCapitalSlider");
    var calc=q("ivXirrCalculate"),reset=q("ivXirrReset"),err=q("ivXirrError"),res=q("ivXirrResult"),cat=q("ivXirrCategory");
    var ti=q("ivXirrTotalInvested"),tw=q("ivXirrTotalWithdrawn"),nd=q("ivXirrNetDeployed"),co=q("ivXirrCurrentOut"),gl=q("ivXirrGainLoss");
    var msg=q("ivXirrMessage"),jc=q("ivXirrJourneyChart"),sc=q("ivXirrSummaryChart"),tt=q("ivXirrTooltip");
    
    // Layout and reveal elements
    var layoutWrapper=q("ivXirrLayoutWrapper");
    var resultsReveal=q("ivXirrResultsReveal");
    var chartsReveal=q("ivXirrChartsReveal");

    if(!body) return;
    function show(m){err.textContent=m; err.style.display=m?"block":"none";}
    function bindRows(){body.querySelectorAll(".iv-xirr-cashflow-row").forEach(function(r){bindDelete(r,body);});}
    
    function run(){
      var collected=collect(body,cc,vd);
      if(collected.error){show(collected.error);return;}
      var rate=calcRate(collected.cashflows);
      if(rate===null||!isFinite(rate)){show("XIRR could not be calculated. Please check entries."); return;}
      show("");
      
      var x=rate*100,net=collected.totalInvested-collected.totalWithdrawn,ag=collected.currentCapital+collected.totalWithdrawn-collected.totalInvested,p=perf(x),deployed=0,pts=[];
      collected.cashflows.forEach(function(cf){
        if(cf.amount<0)deployed+=Math.abs(cf.amount);
        if(cf.label==="Withdrawal")deployed-=cf.amount;
        if(cf.label!=="Current Value")pts.push({date:cf.date,deployed:deployed,value:null,label:cf.label});
      });
      var cur=collected.cashflows[collected.cashflows.length-1];
      pts.push({date:cur.date,deployed:deployed,value:cur.amount,label:"Current Value"});
      
      res.textContent=x.toFixed(2)+"%";
      cat.textContent=p.category;
      ti.textContent=formatINR(collected.totalInvested);
      tw.textContent=formatINR(collected.totalWithdrawn);
      nd.textContent=formatINR(net);
      co.textContent=formatINR(collected.currentCapital);
      gl.textContent=formatINR(ag);
      
      // Style absolute gain/loss color
      if (gl) {
        if (ag >= 0) {
          gl.className = "gain-positive";
        } else {
          gl.className = "gain-negative";
        }
      }

      // Calculate target capital at 24% CAGR and difference (wealth loss)
      var targetRate = 0.24;
      var targetCapital = 0;
      var valDate = cur.date;
      for (var i = 0; i < collected.cashflows.length - 1; i++) {
        var cf = collected.cashflows[i];
        var years = (valDate.getTime() - cf.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        targetCapital += -cf.amount * Math.pow(1 + targetRate, years);
      }
      var wealthDifference = targetCapital - collected.currentCapital;
      
      var promoMsg = "";
      if (wealthDifference > 0) {
        promoMsg = "<br><br><span style='color: #F4D676; font-weight: 700;'>💡 Wealth Optimizer Opportunity:</span> By earning " + x.toFixed(2) + "% instead of our target <b>24.00% CAGR</b>, you missed out on <b>" + formatINR(wealthDifference) + "</b> in potential wealth growth. Had you partnered with us, you could have captured this additional return. Don't leave money on the table—join our <a href='https://intrinsicvalueequity.in/#services' target='_blank' style='color: #F4D676; text-decoration: underline; font-weight: 700;'>service</a> today to optimize your equity portfolio strategy.";
      } else {
        promoMsg = "<br><br>To maintain this performance, join our <a href='https://intrinsicvalueequity.in/#services' target='_blank' style='color: #F4D676; text-decoration: underline; font-weight: 700;'>service</a>.";
      }
      msg.innerHTML = p.message + promoMsg;

      // Adjust layout
      if (layoutWrapper) layoutWrapper.classList.add("calculated");
      if (resultsReveal) resultsReveal.style.display = "block";
      if (chartsReveal) chartsReveal.style.display = "block";

      // Draw charts
      drawJourney(jc,pts);
      drawSummary(sc,{totalInvested:collected.totalInvested,totalWithdrawn:collected.totalWithdrawn,currentCapital:collected.currentCapital,absoluteGainLoss:ag});

      // Trigger animations
      requestAnimationFrame(function () {
        [resultsReveal, chartsReveal].forEach(function (el) {
          if (el) el.classList.add("show");
        });
      });
    }

    function resetAll(){
      body.innerHTML="";
      body.appendChild(createRow("","",""));
      bindRows();
      
      cc.value="0";
      if(ccSlider) ccSlider.value="0";
      vd.value=today();
      show("");
      [res,cat,ti,tw,nd,co,gl].forEach(function(el){el.textContent="—";});
      if (gl) gl.className = "";
      msg.textContent="Enter cashflows and current capital to calculate your annualized portfolio return.";
      [jc,sc].forEach(function(cv){var d=setupCanvas(cv); if(d)d.ctx.clearRect(0,0,d.width,d.height);});
      if(tt)tt.style.display="none";

      // Revert layout
      if (layoutWrapper) layoutWrapper.classList.remove("calculated");
      [resultsReveal, chartsReveal].forEach(function (el) {
        if (el) {
          el.classList.remove("show");
          el.style.display = "none";
        }
      });
    }

    vd.value=today();
    bindRows();
    
    // Set defaults from slider on load
    if (cc && ccSlider) cc.value = ccSlider.value;

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

    setupSync(cc, ccSlider);

    if(add&&!add._ivBound){add._ivBound=true; add.addEventListener("click",function(){body.appendChild(createRow("","","")); bindRows();});}
    calc.addEventListener("click",run);
    if(reset)reset.addEventListener("click",resetAll);
    [cc,vd].forEach(function(i){i&&i.addEventListener("keydown",function(e){if(e.key==="Enter")run();});});
    function move(canvas,mode,e){if(!tt||!canvas)return; var r=canvas.getBoundingClientRect(),x=e.clientX-r.left,d=null; if(mode==="journey"&&canvas._pts){canvas._pts.forEach(function(p){if(!d||Math.abs(p.x-x)<Math.abs(d.x-x))d=p;});} if(mode==="summary"&&canvas._bars){canvas._bars.forEach(function(b){if(x>=b.x&&x<=b.x+b.w)d=b;});} if(!d){tt.style.display="none";return;}
      if(mode==="journey"&&canvas._ptsData) drawJourney(canvas, canvas._ptsData);
      if(mode==="summary"&&canvas._sData) drawSummary(canvas, canvas._sData);
      var ctx=canvas.getContext("2d");
      var w=canvas.width/(window.devicePixelRatio||1);
      var h=canvas.height/(window.devicePixelRatio||1);
      if(mode==="journey"){
        ctx.strokeStyle="rgba(255,255,255,0.2)"; ctx.lineWidth=1; ctx.beginPath();
        if(ctx.setLineDash) ctx.setLineDash([3,3]);
        ctx.moveTo(d.x,18); ctx.lineTo(d.x,h-36); ctx.stroke();
        if(ctx.setLineDash) ctx.setLineDash([]);
        
        ctx.fillStyle="#4C8DFF"; ctx.beginPath(); ctx.arc(d.x,d.yDeployed,4.5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle="rgba(255,255,255,0.4)"; ctx.lineWidth=1.5; ctx.stroke();
        if(d.value!==null&&isFinite(d.yValue)){
          ctx.fillStyle="#D4AF37"; ctx.beginPath(); ctx.arc(d.x,d.yValue,5.5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle="rgba(255,255,255,0.4)"; ctx.lineWidth=1.5; ctx.stroke();
        }
        tt.innerHTML="<b>"+d.label+"</b><br>Date: "+d.date.toISOString().slice(0,10)+"<br>Net deployed: "+formatINR(d.deployed)+(d.value!==null?"<br>Current value: "+formatINR(d.value):"");
      }
      if(mode==="summary"){
        ctx.fillStyle="rgba(255,255,255,0.08)";
        ctx.fillRect(d.x-2,18,d.w+4,h-18-48);
        tt.innerHTML="<b>"+d.label+"</b><br>"+formatINR(d.value);
      }
      tt.style.display="block"; tt.style.left=Math.min(e.clientX+12,window.innerWidth-260)+"px"; tt.style.top=Math.max(e.clientY-18,10)+"px";}
    if(jc){jc.addEventListener("mousemove",function(e){move(jc,"journey",e);}); jc.addEventListener("mouseleave",function(){tt.style.display="none"; if(jc._ptsData) drawJourney(jc, jc._ptsData);});}
    if(sc){sc.addEventListener("mousemove",function(e){move(sc,"summary",e);}); sc.addEventListener("mouseleave",function(){tt.style.display="none"; if(sc._sData) drawSummary(sc, sc._sData);});}
  });
})();

// Artistic normalized thresholds, informed by mechanically stimulated plankton:
// rapid excitation, a brief flash, adaptation under steady stress, then recovery.
// These are not calibrated biological stress measurements or species timings.
export const BIOLUMINESCENCE=Object.freeze({threshold:.040,thresholdSpread:.055,decay:.10,decaySpread:.20,recovery:.90,recoverySpread:.60,rising:.035});
export function strainRate([duDx,duDy,dvDx,dvDy]){return Math.sqrt(2*(duDx*duDx+dvDy*dvDy)+(duDy+dvDx)**2);}
const smooth=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
export function flashStep([energy,refractory,previous],strain,delta,identity=.5){
 const model=BIOLUMINESCENCE,threshold=model.threshold+model.thresholdSpread*identity;
 const stimulus=smooth((strain-threshold)/(threshold*2));
 let light=energy*Math.exp(-delta/(model.decay+model.decaySpread*identity));
 let cooldown=Math.max(0,refractory-delta/(model.recovery+model.recoverySpread*identity));
 if(cooldown<=0&&stimulus>.30&&(stimulus-previous>model.rising||previous<.30)){light=Math.max(light,stimulus);cooldown=1;}
 return [Math.floor(Math.max(0,light)*65535)/65535,cooldown,stimulus];
}
export const flashGLSL=`
float strainRate(vec2 dx,vec2 dy){return sqrt(2.*(dx.x*dx.x+dy.y*dy.y)+pow(dy.x+dx.y,2.));}
vec3 flashStep(vec3 previous,float strain,float delta,float identity){
 float threshold=${BIOLUMINESCENCE.threshold}+${BIOLUMINESCENCE.thresholdSpread}*identity;
 float stimulus=smoothstep(threshold,threshold*3.,strain);
 float light=previous.r*exp(-delta/(${BIOLUMINESCENCE.decay}+${BIOLUMINESCENCE.decaySpread}*identity));
 float cooldown=max(0.,previous.g-delta/(${BIOLUMINESCENCE.recovery}+${BIOLUMINESCENCE.recoverySpread}*identity));
 if(cooldown<=0.&&stimulus>.30&&(stimulus-previous.b>${BIOLUMINESCENCE.rising}||previous.b<.30)){light=max(light,stimulus);cooldown=1.;}
 // Round fading light down before two-channel RGBA8 storage, so low values cannot get
 // trapped forever by the target's round-to-nearest quantization.
 return vec3(floor(max(0.,light)*65535.)/65535.,cooldown,stimulus);
}
`;

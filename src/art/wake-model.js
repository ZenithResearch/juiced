// A surface wake retains stirring energy after contact has passed. This is a
// bounded, advected turbulence proxy, independent of visible wave height.
export const WAKE=Object.freeze({lifetime:1.10,radius:.065,speed:.30,flowScale:.18});
export const wakeDecay=(energy,delta)=>Math.floor(Math.max(0,energy)*Math.exp(-delta/WAKE.lifetime)*255)/255;
export function segmentWake(point,from,to,strength=1){
 const d=to.map((v,i)=>v-from[i]),n=d[0]**2+d[1]**2;
 if(n<1e-10||strength<=0)return 0;
 const t=Math.max(0,Math.min(1,((point[0]-from[0])*d[0]+(point[1]-from[1])*d[1])/n));
 const r=point.map((v,i)=>v-from[i]-d[i]*t);
 return Math.exp(-(r[0]**2+r[1]**2)/(WAKE.radius**2))*strength;
}

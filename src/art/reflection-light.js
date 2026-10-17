// Lift dim camera midtones without clipping bright faces or changing framing.
export function reflectionTone(light){
 const value=Math.max(0,Math.min(1,light));
 return Math.pow(1-Math.pow(1-value,2.4),.68);
}
export const reflectionLightGLSL=`
float reflectionTone(float light){return pow(1.-pow(1.-clamp(light,0.,1.),2.4),.68);}
`;

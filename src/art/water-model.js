// Normalized world units. The rim is uniform: no angle has a preferred outlet.
export const WATER_MODEL=Object.freeze({size:128,radius:.835,depth:.05,gravity:2.2,freeboard:.002,discharge:.58,heightScale:.125,flowScale:.5,pressureHead:.010,damping:.9964,maxSpeed:.14,step:1/120});
export function rimDischarge(height,outwardSpeed=0,model=WATER_MODEL){
 const head=Math.max(0,height-model.freeboard+Math.max(0,outwardSpeed)**2/(2*model.gravity));
 return model.discharge*Math.sqrt(2*model.gravity)*head**1.5;
}
export const modelGLSL=`
const float WATER_RADIUS=${WATER_MODEL.radius};
const float WATER_DEPTH=${WATER_MODEL.depth};
const float WATER_GRAVITY=${WATER_MODEL.gravity.toFixed(6)};
const float RIM_HEIGHT=${WATER_MODEL.freeboard};
const float HEIGHT_SCALE=${WATER_MODEL.heightScale};
const float FLOW_SCALE=${WATER_MODEL.flowScale};
float unpack16(vec2 value){return (dot(floor(value*255.+.5),vec2(256.,1.))-32768.)/32767.;}
vec2 pack16(float value){float n=floor(clamp(value,-1.,1.)*32767.+32768.+.5);return vec2(floor(n/256.),mod(n,256.))/255.;}
float discharge(float height,float speed){
 float head=max(0.,height-RIM_HEIGHT+pow(max(speed,0.),2.)/(2.*WATER_GRAVITY));
 return ${WATER_MODEL.discharge}*sqrt(2.*WATER_GRAVITY)*pow(head,1.5);
}
`;

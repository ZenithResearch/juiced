// One mirrored camera image covers the viewport with its aspect preserved.
// This virtual image is never drawn outside the water's existing surface mask.
export function viewportCameraUV(point,viewportAspect,cameraAspect){
 return [.5-(point[0]-.5)*Math.min(1,viewportAspect/cameraAspect),.5+(.5-point[1])*Math.min(1,cameraAspect/viewportAspect)];
}

// Sample the renderer's exact pool -> viewport mapping at an affine basis.
// Translation, rotation, tilt, scroll and responsive layout share one mapping;
// no camera rectangle or independent fitting boundary exists in the basin.
export function cameraProjection(viewportPoints,viewportAspect,cameraAspect){
 const [origin,x,y]=viewportPoints.map(point=>viewportCameraUV(point,viewportAspect,cameraAspect));
 return {origin,basis:[x[0]-origin[0],x[1]-origin[1],y[0]-origin[0],y[1]-origin[1]]};
}
export function projectedCameraUV(q,{origin,basis}){
 return [origin[0]+q[0]*basis[0]+q[1]*basis[2],origin[1]+q[0]*basis[1]+q[1]*basis[3]];
}
export const cameraProjectionGLSL=`
vec2 cameraUV(vec2 q){return uCameraOrigin+mat2(uCameraBasis.xy,uCameraBasis.zw)*q;}
`;

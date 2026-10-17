// Capture-only source. The production build never imports this composition.
import {OpticalRenderer} from '../art/optical-renderer.js';
const art=new OpticalRenderer(document.querySelector('.lens-art'));
art.setQuiet(true);
window.addEventListener('pagehide',()=>art.destroy(),{once:true});

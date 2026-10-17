import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,brandQuestionnaireSections,getBrandQuestionnaire,saveBrandQuestionnaire,brandQuestionnaireProgress,prepareBrandRoundtableHandoff,activeBrandQuestion,brandHandoffIsCurrent} from '../src/model.js';
import {legacyBrandQuestionnaireSections} from '../src/questionnaire-legacy.js';
import {dashboardData} from '../src/dashboard-model.js';
import {questionnaireView} from '../src/questionnaire-view.js';

test('discovery keeps known brand details as context, without inventing fragments or mutating old records',()=>{
 const state=emptyState();state.brand={...state.brand,name:'Existing brand',description:'Existing description',audience:'Existing audience',voice:'Existing voice'};state.assets=[{id:'one',name:'Existing source.pdf'}];
 const before=JSON.stringify(state),draft=getBrandQuestionnaire(state);
 assert.equal(draft.version,2);assert.equal(draft.step,'materials');assert.ok(Object.values(draft.answers).every(value=>value===''));
 assert.deepEqual(draft.existingBrandDetails,state.brand);assert.deepEqual(draft.sourceIds,['one']);assert.equal(JSON.stringify(state),before);
});
test('V1 answers stay attached to their original prompts and archive once on first V2 save',()=>{
 const state=emptyState();state.assets=[{id:'one',name:'Source.pdf'}];state.world={brandQuestionnaire:{version:1,futureField:'keep',answers:{goals:'  Build trust  ',futureAnswer:'keep'},sourceIds:['one','gone'],step:'voice'}};
 const before=JSON.stringify(state),draft=getBrandQuestionnaire(state);
 assert.equal(draft.answers.firstPull,'');assert.equal(draft.earlier[0].answers.goals,'  Build trust  ');
 assert.deepEqual(draft.earlier[0].sections,legacyBrandQuestionnaireSections);assert.equal(draft.step,'materials');
 const first=saveBrandQuestionnaire(state,{answers:{firstPull:'A small frustration.'},step:'brand-book',activeQuestion:'costlyConviction'});
 const second=saveBrandQuestionnaire(first,{answers:{costlyConviction:'Not rushing the work.'}});
 assert.equal(second.world.brandQuestionnaireHistory.length,1);assert.equal(second.world.brandQuestionnaireHistory[0].futureField,'keep');
 assert.equal(second.world.brandQuestionnaireHistory[0].answers.futureAnswer,'keep');assert.deepEqual(second.world.brandQuestionnaireHistory[0].sourceIds,['one','gone']);
 assert.deepEqual(second.world.brandQuestionnaire.sourceIds,['one']);assert.equal(getBrandQuestionnaire(second).activeQuestion,'costlyConviction');assert.equal(JSON.stringify(state),before);
});
test('fragments merge, clear, resume, validate atomically and preserve unrelated or future V2 data',()=>{
 const state=emptyState();state.assets=[{id:'one',name:'Source.pdf'}];state.world={team:[{name:'Member'}],pieces:{'brand-book':{assetIds:['one'],currentAssetId:'one'}},brandQuestionnaire:{version:2,futureField:'keep',answers:{futureAnswer:'keep'},origins:{futureAnswer:'keep'}}};
 const first=saveBrandQuestionnaire(state,{answers:{firstPull:'  A real memory.  ',unregistered:'ignore'},origins:{firstPull:'lived'},sourceIds:['one','one','missing'],step:'characters',activeQuestion:'desireAndContinuity'});
 const second=saveBrandQuestionnaire(first,{answers:{firstPull:''},origins:{firstPull:''}});
 assert.equal(second.world.brandQuestionnaire.answers.firstPull,'');assert.equal(second.world.brandQuestionnaire.answers.futureAnswer,'keep');assert.equal(second.world.brandQuestionnaire.origins.futureAnswer,'keep');assert.equal(second.world.brandQuestionnaire.futureField,'keep');
 assert.equal(second.world.brandQuestionnaire.answers.unregistered,undefined);assert.deepEqual(second.world.brandQuestionnaire.sourceIds,['one']);
 assert.equal(second.world.pieces,state.world.pieces);assert.equal(second.assets,state.assets);assert.equal(second.brand,state.brand);assert.equal(second.world.team,state.world.team);
 const draft=getBrandQuestionnaire(second);assert.equal(draft.step,'characters');assert.equal(activeBrandQuestion(draft).id,'desireAndContinuity');
 const before=JSON.stringify(second);assert.throws(()=>saveBrandQuestionnaire(second,{answers:{firstPull:'x'.repeat(4001)}}));assert.throws(()=>saveBrandQuestionnaire(second,{origins:{firstPull:'diagnosis'}}));assert.equal(JSON.stringify(second),before);
 assert.throws(()=>saveBrandQuestionnaire({...state,world:{brandQuestionnaire:{version:3}}},{}));
});
test('roundtable packet preserves verbatim evidence and basis, separates interpretations, and maps five outputs',()=>{
 const state=emptyState();state.brand.name='Known name';state.assets=[{id:'one',name:'Source.pdf',kind:'file',type:'application/pdf',blob:'not included'},{id:'two',name:'Not selected.pdf'}];
 const answered=saveBrandQuestionnaire(state,{answers:{firstPull:'  A real memory.  ',feltPlace:'Quiet light on a station platform.'},origins:{firstPull:'lived',feltPlace:'mixed'},sourceIds:['one'],step:'review'});
 const prepared=prepareBrandRoundtableHandoff(answered),packet=prepared.world.brandRoundtableHandoff,draft=getBrandQuestionnaire(prepared);
 assert.equal(packet.version,2);assert.equal(packet.status,'prepared');assert.equal(packet.destination,'creative-roundtable');assert.equal(packet.workflow,'brand-package');assert.equal(packet.existingBrandDetails.name,'Known name');
 assert.deepEqual(packet.sourceIds,['one']);assert.equal(packet.sources.length,1);assert.equal(packet.sources[0].blob,undefined);
 assert.equal(packet.evidence[0].text,'  A real memory.  ');assert.equal(packet.evidence[0].prompt,brandQuestionnaireSections[0].questions[0].label);assert.equal(packet.evidence[0].subject,'founder-or-steward');assert.equal(packet.evidence[0].basis,'lived');
 assert.deepEqual(packet.interpretations,[]);assert.equal(packet.openThreads.length,8);assert.equal(packet.outputs.length,5);assert.ok(packet.outputs.every(output=>output.questionIds.length));assert.ok(!packet.outputs.some(output=>output.id==='creative-assets'));
 assert.equal(prepared.assets,answered.assets);assert.equal(prepared.world.pieces,answered.world.pieces);assert.equal(dashboardData(prepared).available,0);assert.equal(answered.world.brandRoundtableHandoff,undefined);assert.ok(brandHandoffIsCurrent(packet,draft));
 const navigationOnly=saveBrandQuestionnaire(prepared,{step:'identity'});assert.equal(navigationOnly.world.brandRoundtableHandoff.status,'prepared');
 for(const patch of [{answers:{firstPull:'Another memory'}},{origins:{firstPull:'imagined'}},{sourceIds:[]}])assert.equal(saveBrandQuestionnaire(prepared,patch).world.brandRoundtableHandoff.status,'needs-update');
 const renamed={...prepared,brand:{...prepared.brand,name:'New name'}};assert.ok(!brandHandoffIsCurrent(packet,getBrandQuestionnaire(renamed)));assert.equal(saveBrandQuestionnaire(renamed,{}).world.brandRoundtableHandoff.status,'needs-update');assert.equal(packet.existingBrandDetails.name,'Known name');
 assert.throws(()=>prepareBrandRoundtableHandoff(emptyState()));
});
test('earlier evidence and handoffs remain available without being reinterpreted as V2 answers',()=>{
 const state=emptyState();const oldPacket={version:1,status:'prepared',answers:{goals:'Earlier intention'}};state.world={brandQuestionnaire:{version:1,answers:{goals:'Earlier intention'},sourceIds:[]},brandRoundtableHandoff:oldPacket};
 const migrated=saveBrandQuestionnaire(state,{step:'review'}),prepared=prepareBrandRoundtableHandoff(migrated),packet=prepared.world.brandRoundtableHandoff;
 assert.deepEqual(packet.evidence,[]);assert.equal(packet.earlierQuestionnaires[0].answers.goals,'Earlier intention');assert.equal(packet.answers.firstPull,'');assert.deepEqual(prepared.world.brandRoundtableHandoffHistory,[oldPacket]);
 assert.ok(!brandHandoffIsCurrent(oldPacket,getBrandQuestionnaire(state)));assert.ok(brandHandoffIsCurrent(packet,getBrandQuestionnaire(prepared)));
 const future=saveBrandQuestionnaire({...prepared,world:{...prepared.world,brandQuestionnaire:{...prepared.world.brandQuestionnaire,answers:{...prepared.world.brandQuestionnaire.answers,extra:'keep'}}}},{step:'materials'});assert.equal(future.world.brandRoundtableHandoff.status,'prepared');
});
test('discovery progress counts ten supplied fragments and keeps output identifiers stable',()=>{
 const draft=getBrandQuestionnaire(emptyState());draft.answers.firstPull='A memory';draft.answers.feltPlace='  ';
 const progress=brandQuestionnaireProgress(draft);assert.equal(progress.answered,1);assert.equal(progress.total,10);assert.equal(progress.sections.find(s=>s.id==='brand-book').answered,1);
 assert.deepEqual(brandQuestionnaireSections.map(s=>s.id),['brand-book','characters','voice','identity','design-system']);assert.ok(brandQuestionnaireSections.every(section=>section.questions.length===2));
});
test('one invitation at a time and review safely render new, earlier and source text',()=>{
 const state=emptyState(),draft=getBrandQuestionnaire(state);draft.answers.firstPull='<img src=x onerror=alert(1)>';draft.step='brand-book';draft.activeQuestion='firstPull';
 const form=questionnaireView(draft,[]);assert.ok(form.includes('&lt;img'));assert.ok(!form.includes('<img src=x'));assert.equal((form.match(/<textarea/g)||[]).length,1);assert.ok(!form.includes('data-questionnaire-answer="costlyConviction"'));
 draft.earlier=[{answers:{goals:'<script>old</script>'},sections:legacyBrandQuestionnaireSections}];draft.step='review';const review=questionnaireView(draft,[]);assert.ok(review.includes('&lt;img'));assert.ok(review.includes('&lt;script&gt;old'));assert.ok(!review.includes('<script>'));assert.ok(review.includes('Earlier questionnaire answers'));assert.ok(!review.includes('consultant fit'));
 draft.step='materials';const material=questionnaireView(draft,[{id:'one',name:'<script>bad</script>',kind:'file'}]);assert.ok(material.includes('&lt;script&gt;'));assert.ok(!material.includes('<script>bad'));
});

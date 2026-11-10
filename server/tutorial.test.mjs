import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTutorial,freshTutorial,validTutorial} from '../src/tutorial-state.ts';
test('tutorial follows creation and the correct profile, postponing social until a second fish',()=>{
 let state={...freshTutorial(),step:'create'};
 assert.equal(advanceTutorial(state,[],'add'),state);
 state=advanceTutorial(state,['mine'],'home');assert.equal(state.step,'observe');assert.equal(state.fishId,'mine');
 assert.equal(advanceTutorial(state,['mine'],'fish','someone-else'),state);
 state=advanceTutorial(state,['mine'],'fish','mine');assert.equal(state.step,'profile');
 state={...state,step:'waiting'};assert.equal(advanceTutorial(state,['mine'],'home'),state);
 state=advanceTutorial(state,['mine','mine-2'],'home');assert.equal(state.step,'social');
});
test('skipped tutorials stay skipped, missing fish recover safely, and saved progress validates',()=>{
 const paused={version:1,status:'paused',step:'create'};assert.equal(advanceTutorial(paused,['mine'],'home'),paused);
 assert.equal(advanceTutorial({version:1,status:'active',step:'observe',fishId:'lost'},[],'home').step,'create');
 assert.equal(validTutorial({version:1,status:'active',step:'invented'}),false);assert.equal(validTutorial(freshTutorial()),true);
});

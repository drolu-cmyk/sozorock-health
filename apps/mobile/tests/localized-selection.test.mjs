import assert from "node:assert/strict";
import test from "node:test";
import { translateSelection } from "../src/localized-selection.ts";
test("changing language preserves the selected option's submission index",()=>{
 const en=["Virtual visit","Digital support","Resources","Not sure"],es=["Visita virtual","Apoyo digital","Recursos","No sé"];
 for(let i=0;i<en.length;i++){const next=translateSelection(en[i],en,es);assert.equal(es.indexOf(next),i);assert.equal(translateSelection(next,es,en),en[i]);}
 assert.equal(translateSelection("",en,es),"");assert.equal(translateSelection("old option",en,es),"");
});

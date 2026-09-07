import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceNumber } from '../app/lib/source-number.ts';
test('missing and invalid evidence never become a source zero',()=>{for(const value of [null,undefined,'',' ',false,true,[],{},NaN,Infinity,'unknown',-1])assert.equal(sourceNumber(value),null);});
test('an explicit published zero is preserved',()=>{assert.equal(sourceNumber(0),0);assert.equal(sourceNumber('0'),0);assert.equal(sourceNumber(' 23.4 '),23.4);});

import assert from "node:assert/strict";
import test from "node:test";
import { authenticateCognitoAuthority } from "../app/lib/cognito-authority.ts";
const expected={userPoolId:"us-east-1_ExpectedPool",clientId:"expectedClient"};
const base={iss:"https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ExpectedPool",client_id:"expectedClient",token_use:"access",exp:Date.now()/1000+300};
const token=claims=>`${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.upstreamSignature`;
test("the accepted authority always forwards the identical token for upstream authentication",async()=>{
  const value=token(base); let calls=0;
  const result=await authenticateCognitoAuthority(value,expected,async forwarded=>{assert.equal(forwarded,value);calls++;return {Username:"authenticated"};});
  assert.equal(calls,1);assert.equal(result.Username,"authenticated");
});
test("foreign issuer/client, ID tokens and invalid expiry never reach GetUser",async()=>{
  for(const claims of [{...base,iss:base.iss+'other'},{...base,client_id:'other'},{...base,token_use:'id'},{...base,exp:0},{...base,exp:'99999999999'},{...base,exp:undefined}]) {
    await assert.rejects(authenticateCognitoAuthority(token(claims),expected,async()=>assert.fail('must reject before identity use')),/Invalid authenticated session/);
  }
});
test("decoded matching claims cannot bypass an upstream invalid signature rejection",async()=>{
  await assert.rejects(authenticateCognitoAuthority(token(base),expected,async()=>{throw new Error('Signature rejected');}),/Signature rejected/);
});
test("missing authority and malformed tokens fail closed",async()=>{
  await assert.rejects(authenticateCognitoAuthority(token(base),{},async()=>assert.fail()),/not configured/);
  for(const value of ['not-a-token','a.b.c','a..c','a.b.c.d']) await assert.rejects(authenticateCognitoAuthority(value,expected,async()=>assert.fail()),/Invalid/);
});

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const origin = process.env.CBCAP_QA_ORIGIN || 'http://127.0.0.1:3100';
const browser = await chromium.launch();
await mkdir('out', {recursive:true});
const results=[];
try {
  for (const [name,width,height] of [['mobile-small',320,740],['mobile',390,844],['tablet',768,1024],['tablet-wide',1024,768],['desktop',1440,1000],['wide',1920,1080]]) {
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Albany County',exact:true}).waitFor();
    assert.ok((await page.getByRole('heading',{level:1}).innerText()).includes('plan you can defend'));
    assert.equal(await page.getByRole('navigation',{name:'CB-CAP',exact:true}).getByRole('link').count(),4);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);assert.equal(overflow,false,`${name} horizontal overflow`);
    await page.getByText('Sources and what these numbers mean',{exact:true}).click();
    assert.ok(await page.getByText('95% confidence interval',{exact:false}).count()>0);
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    const violations=axe.violations.filter(item=>['serious','critical'].includes(item.impact));
    await page.screenshot({path:`out/${name}.png`,fullPage:true});
    results.push({name,width,height,errors,violations:violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
    assert.deepEqual(errors,[],`${name} browser errors`);assert.deepEqual(violations,[],`${name} accessibility violations`);
    await page.getByLabel('State',{exact:true}).selectOption('06');
    const selectedCounty=await page.getByLabel('County',{exact:true}).inputValue();
    assert.ok(selectedCounty.startsWith('06'));
    await page.getByRole('heading',{name:'Alameda County',exact:true}).waitFor();
    await page.getByRole('link',{name:'Sign in',exact:true}).click();
    await page.getByText('Institutional access is not available in this release.',{exact:true}).waitFor();
    assert.equal(await page.locator('pre:visible').count(),0);
    assert.equal(await page.getByRole('button',{name:'Start planning review',exact:true}).count(),0);
    await page.close();
  }
} finally { await writeFile('out/results.json',JSON.stringify(results,null,2));await browser.close(); }

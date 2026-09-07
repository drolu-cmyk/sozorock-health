import {Audio} from "@remotion/media";
import {AbsoluteFill, Sequence, staticFile, useCurrentFrame, interpolate} from "remotion";
import {QuestionScene} from "./QuestionScene";
import {ClosingScene} from "./ClosingScene";
export function CBCAPCampaign(){const frame=useCurrentFrame();return <AbsoluteFill>
 <Audio src={staticFile('gpt-live-campaign/ambient-bed.wav')} volume={interpolate(frame,[0,45,720,779],[0,.5,.5,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})} />
 <Sequence from={0} durationInFrames={150} name="County planning"><QuestionScene kicker="The planning question" title="What belongs in our county plan?" detail="Start with evidence. Keep local context in view." /></Sequence>
 <Sequence from={150} durationInFrames={150} name="Evidence"><QuestionScene kicker="See the evidence" title="Where did this come from?" detail="Explore a real county. Keep sources, dates and missing evidence visible." dark /></Sequence>
 <Sequence from={300} durationInFrames={150} name="Assumptions"><QuestionScene kicker="Test the options" title="What assumption did we use?" detail="A planning scenario is an illustration. It is not a prediction." /></Sequence>
 <Sequence from={450} durationInFrames={150} name="Human review"><QuestionScene kicker="Build the plan" title="Who reviews the decision?" detail="AI drafts. People decide." dark /></Sequence>
 <Sequence from={600} durationInFrames={180} name="CB-CAP"><ClosingScene /></Sequence>
 </AbsoluteFill>;}

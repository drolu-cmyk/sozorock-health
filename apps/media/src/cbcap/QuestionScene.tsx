import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
export function QuestionScene({kicker,title,detail,dark=false}:{kicker:string;title:string;detail:string;dark?:boolean}) {
 const frame=useCurrentFrame();const {height}=useVideoConfig();
 return <AbsoluteFill style={{background:dark?'#172b42':'#f3f7fb',color:dark?'#f4f8fc':'#172b42',padding:84,fontFamily:'Arial, Helvetica, sans-serif',justifyContent:'center'}}>
  <div style={{position:'absolute',top:height>1500?190:80,left:84,fontSize:28,letterSpacing:5,fontWeight:700}}>CB-CAP</div>
  <div style={{fontSize:26,letterSpacing:3,textTransform:'uppercase',marginBottom:40,color:dark?'#bbcee8':'#3e5f86'}}>{kicker}</div>
  <div style={{fontSize:96,fontWeight:700,letterSpacing:-5,lineHeight:1.05,maxWidth:850,translate:interpolate(frame,[0,22],['0px 45px','0px 0px'],{extrapolateRight:'clamp',easing:Easing.bezier(.16,1,.3,1)}),opacity:interpolate(frame,[0,15],[0,1],{extrapolateRight:'clamp'})}}>{title}</div>
  <div style={{fontSize:34,lineHeight:1.5,marginTop:44,maxWidth:800,opacity:interpolate(frame,[18,34],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>{detail}</div>
  <div style={{position:'absolute',bottom:height>1500?210:85,left:84,right:84,fontSize:23,color:dark?'#c7d7e9':'#4b647e'}}>County planning for health access</div>
 </AbsoluteFill>;
}

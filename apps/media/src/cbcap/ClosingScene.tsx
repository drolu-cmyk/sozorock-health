import {AbsoluteFill, Img, staticFile, useVideoConfig} from "remotion";
export function ClosingScene(){const {height}=useVideoConfig();return <AbsoluteFill style={{background:'#edf3fa',justifyContent:'center',alignItems:'center'}}><Img src={staticFile('cbcap-planning/poster.jpg')} style={{width:'100%',height:Math.min(height,1350),objectFit:'contain'}} /></AbsoluteFill>;}

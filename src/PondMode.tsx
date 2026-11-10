import {createContext,useContext} from 'react';
export const PondModeContext=createContext({demo:true});
export const usePondMode=()=>useContext(PondModeContext);
export const demoKey=(key:string)=>'pond-demo-v1:'+key;

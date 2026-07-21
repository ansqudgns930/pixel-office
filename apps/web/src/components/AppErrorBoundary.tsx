import { Component, type ErrorInfo, type ReactNode } from "react";

export default class AppErrorBoundary extends Component<{children:ReactNode},{error:string|null}>{
  state:{error:string|null}={error:null};
  static getDerivedStateFromError(error:unknown){return{error:error instanceof Error?error.message:String(error)};}
  componentDidCatch(error:unknown,info:ErrorInfo){console.error("UI route failed",error,info.componentStack);}
  render(){if(!this.state.error)return this.props.children;return <main className="fatal-error" role="alert"><span className="fatal-error-code">UI ERROR</span><h1>화면을 표시하지 못했습니다.</h1><p>{this.state.error}</p><div><button onClick={()=>{this.setState({error:null});window.location.reload();}}>다시 불러오기</button><a className="button-link" href="/execution">고급 실행으로 이동</a></div></main>;}
}

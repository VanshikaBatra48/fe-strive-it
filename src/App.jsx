import { BrowserRouter, Routes, Route } from "react-router-dom"

import Login  from "./pages/Login"
import Dashboards from "./pages/Dashboard/Dashboards"

const App = () => {

  return (
    <BrowserRouter>
    <Routes>
        <Route path="/" element = {<Login />}/>
        <Route path="/dashboard" element = {<Dashboards />}/>
    </Routes>
    
    </BrowserRouter>
    
  )
}

export default App

import { createRoot } from 'react-dom/client'
import { DevBar } from './DevBar'

const host = document.createElement('div')
document.body.append(host)
createRoot(host).render(<DevBar />)

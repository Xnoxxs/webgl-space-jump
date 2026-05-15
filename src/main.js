import './style.css'
import Experience from './Experience.js'

// Bootstrap the cinematic experience on a full-screen canvas
const canvas = document.querySelector('canvas.webgl')
new Experience(canvas)

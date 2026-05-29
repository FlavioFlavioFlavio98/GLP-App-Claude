import {
  Chart,
  LineController, LineElement, PointElement,
  BarController, BarElement,
  DoughnutController, ArcElement,
  LinearScale, CategoryScale, LogarithmicScale,
  Tooltip, Legend, Filler,
} from 'chart.js'

Chart.register(
  LineController, LineElement, PointElement,
  BarController, BarElement,
  DoughnutController, ArcElement,
  LinearScale, CategoryScale, LogarithmicScale,
  Tooltip, Legend, Filler,
)

Chart.defaults.color = '#888'
Chart.defaults.borderColor = '#333'

export { Chart }

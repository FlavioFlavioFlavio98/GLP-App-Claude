import { useCountUp } from '../hooks/useCountUp'

export default function AnimatedNumber({ value, className = '', prefix = '', suffix = '' }) {
  const { displayVal, animClass } = useCountUp(value)
  return (
    <span className={[className, animClass].filter(Boolean).join(' ')}>
      {prefix}{displayVal}{suffix}
    </span>
  )
}

import { Coins, Sparkles } from 'lucide-react'

export default function RanchScene() {
  return (
    <div className="ranch-scene" aria-label="Bandit Buddy ranch illustration">
      <div className="scene-sky">
        <div className="sun" />
        <span className="cloud cloud-one" />
        <span className="cloud cloud-two" />
        <span className="mountain mountain-back" />
        <span className="mountain mountain-front" />
      </div>
      <div className="scene-ground">
        <div className="path path-main" />
        <div className="path path-side" />
        <div className="ranch-house">
          <div className="house-roof" />
          <div className="house-body"><span className="window" /><span className="door" /></div>
          <div className="chimney" />
        </div>
        <div className="barn"><div className="barn-roof" /><div className="barn-door" /></div>
        <div className="cactus cactus-left"><i /><i /></div>
        <div className="cactus cactus-right"><i /><i /></div>
        <div className="fence fence-left" /><div className="fence fence-right" />
        <div className="field field-one"><span /><span /><span /><span /><span /><span /></div>
        <div className="field field-two"><span /><span /><span /><span /><span /><span /></div>
        <div className="buddy">
          <div className="buddy-hat" />
          <div className="buddy-head">
            <span className="eye eye-left" /><span className="eye eye-right" /><span className="bandana" />
          </div>
          <div className="buddy-body" />
          <div className="buddy-leg leg-left" /><div className="buddy-leg leg-right" />
          <div className="buddy-arm" />
        </div>
        <div className="dog"><span className="dog-ear" /><span className="dog-tail" /></div>
        <div className="signpost"><span>BANDIT<br />VALLEY</span></div>
        <div className="coin coin-one"><Coins size={12} /></div>
        <div className="coin coin-two"><Coins size={12} /></div>
      </div>
      <div className="scene-label"><Sparkles size={14} /> Your frontier awaits</div>
    </div>
  )
}

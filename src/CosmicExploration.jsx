import { useEffect } from 'react'
import ActivityNav from './ActivityNav'
import './CosmicExploration.css'

const HERO_IMAGE = 'https://lds-img.finalfantasyxiv.com/h/O/F72rOas_wW_S8ZFg0wsISXRnpw.jpg'

const I = {
  spark: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5"/><circle cx="12" cy="12" r="2.3"/></svg>,
  route: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h3a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></svg>,
  tablet: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 7h4M10 11h4M10 15h2"/></svg>,
  alert: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg>,
  coin: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h3.1a1.4 1.4 0 0 1 0 2.8h-1.2a1.4 1.4 0 0 0 0 2.8h3.1"/></svg>,
  tool: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m14.7 6.3-8 8a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l8-8-3-3Z"/><path d="m16 2 6 6-2 2-6-6 2-2ZM4 20l1-4 3 3-4 1Z"/></svg>,
}

const unlocks = [
  { star: 'Sinus Ardorum', quest: 'A Cosmic Homecoming', npc: 'Namingway', place: 'Old Sharlayan', coords: 'X:12.6, Y:13.6', requires: 'DoH/DoL level 10 + Endwalker MSQ' },
  { star: 'Phaenna', quest: 'Go Forth, Brave Explorers', npc: 'Searchingway', place: 'Sinus Ardorum', coords: 'X:20.4, Y:20.0', requires: 'Passion, Thy Name Is Ardorum' },
  { star: 'Oizys', quest: 'Mission of Gravity', npc: 'Searchingway', place: 'Phaenna', coords: 'X:27.2, Y:13.8', requires: 'The Brightest Star' },
  { star: 'Auxesia', quest: 'The Forests of Paradise', npc: 'Searchingway', place: 'Oizys', coords: 'X:17.1, Y:22.8', requires: "Memory's Orbit" },
]

const loop = [
  { title: 'Open the Exotablet', body: 'Check current progress, pick a Stellar Mission, and keep an eye on projects, successes, class tracker, and standings.' },
  { title: 'Run Stellar Missions', body: 'Craft or gather the requested items through the mission widget. Aim for Gold because higher scores pay more and unlock follow-up mission opportunities.' },
  { title: 'React to Alerts', body: 'When red alerts or projects appear, swap to the requested class if you can. Critical missions and projects pay better than regular mission spam.' },
  { title: 'Spend and Upgrade', body: 'Convert currencies into rewards, fortunes, pilot applications, and tool progress. Cosmic tool research accrues from Stellar Missions for each class.' },
]

const missionTypes = [
  { name: 'Basic Stellar Missions', icon: I.tablet, detail: 'Bread-and-butter tasks accepted from the Exotablet. They raise exploration progress and class research.' },
  { name: 'Sequential Missions', icon: I.spark, detail: 'Provisional missions that appear after Gold-rated clears. Chain them while they are available for stronger returns.' },
  { name: 'Weather and Time Missions', icon: I.route, detail: 'Provisional missions tied to specific time or weather windows. Good to prioritize when they are up.' },
  { name: 'Critical Missions', icon: I.alert, detail: 'Red-alert missions with class-demand gauges. Fill both gauges before time expires for the better shared reward.' },
  { name: 'Mech Ops', icon: I.tool, detail: 'Scheduled large directives. Apply as a pilot from the Exotablet or join on the field as ground support.' },
  { name: 'Tool Mastery', icon: I.coin, detail: 'Auxesia missions unlocked after a final-stage cosmic tool. Push score objectives for points, tokens, titles, and standings.' },
]

const vendors = [
  { star: 'Auxesia', spender: 'Mesouaidonque', spendCoords: 'X:27.8, Y:29.0', fortune: 'Orbitingway', fortuneCoords: 'X:27.2, Y:28.4', credit: 'Auxesia Credits', special: 'Auxesia Exploration Tokens from EX+ or tool mastery missions' },
  { star: 'Oizys', spender: 'Mesouaidonque', spendCoords: 'X:17.4, Y:24.5', fortune: 'Orbitingway', fortuneCoords: 'X:18.3, Y:24.5', credit: 'Oizys Credits', special: 'Oizys Exploration Tokens from EX+ missions' },
  { star: 'Phaenna', spender: 'Mesouaidonque', spendCoords: 'X:28.6, Y:13.4', fortune: 'Orbitingway', fortuneCoords: 'X:28.6, Y:12.7', credit: 'Phaenna Credits', special: 'Phaenna Exploration Tokens from EX+ missions' },
  { star: 'Sinus Ardorum', spender: 'Mesouaidonque', spendCoords: 'X:21.8, Y:21.8', fortune: 'Orbitingway', fortuneCoords: 'X:21.8, Y:21.1', credit: 'Lunar Credits', special: 'Pilot applications via Alerot at X:22.4, Y:20.3' },
]

const sources = [
  { label: 'Official Cosmic Exploration Guide', href: 'https://na.finalfantasyxiv.com/lodestone/cosmic_exploration/' },
  { label: 'Patch 7.21 Notes', href: 'https://na.finalfantasyxiv.com/lodestone/topics/detail/6f824223a7e10da7b9b7dfc84f626d10d4df88b3/' },
  { label: 'Patch 7.51 Notes', href: 'https://na.finalfantasyxiv.com/lodestone/topics/detail/c46881a31a2c90d0965493c921b434eca09113f8' },
]

function Step({ item, index }) {
  return (
    <article className="cos-step">
      <div className="cos-step__num">{index + 1}</div>
      <h3>{item.title}</h3>
      <p>{item.body}</p>
    </article>
  )
}

export default function CosmicExploration() {
  useEffect(() => {
    document.body.classList.add('cosmic-page')
    return () => document.body.classList.remove('cosmic-page')
  }, [])

  return (
    <main className="cos-shell">
      <ActivityNav />

      <section className="cos-hero" style={{ '--hero': `url(${HERO_IMAGE})` }}>
        <div className="cos-hero__content">
          <p className="cos-kicker">Crafting & Gathering</p>
          <h1>Cosmic Exploration</h1>
          <p>Use Stellar Missions to build each star, earn cosmic currencies, raise class research, and progress cosmic tools without losing track of where the important NPCs are.</p>
          <div className="cos-hero__actions">
            <a href="#unlock">Unlock</a>
            <a href="#loop">Run Loop</a>
            <a href="#currencies">Currencies</a>
            <a href="#tools">Tools</a>
          </div>
        </div>
      </section>

      <section className="cos-band" id="unlock">
        <div className="cos-section-head">
          <p className="cos-kicker">Start Here</p>
          <h2>Unlock Path</h2>
        </div>
        <div className="cos-unlocks">
          {unlocks.map((row) => (
            <article className="cos-unlock" key={row.star}>
              <div>
                <span>{row.star}</span>
                <h3>{row.quest}</h3>
              </div>
              <p>{row.npc} in {row.place}</p>
              <strong>{row.coords}</strong>
              <small>{row.requires}</small>
            </article>
          ))}
        </div>
        <div className="cos-note">
          <I.route />
          <p>Cosmic Exploration is Home World only. After unlocking stars, travel through the Bestways Burrow aetheryte, Drivingway in Mare Lamentorum at X:21.9, Y:13.2, or Cruisingway on your current star.</p>
        </div>
      </section>

      <section className="cos-band" id="loop">
        <div className="cos-section-head">
          <p className="cos-kicker">What To Do</p>
          <h2>The Session Loop</h2>
        </div>
        <div className="cos-steps">
          {loop.map((item, index) => <Step key={item.title} item={item} index={index} />)}
        </div>
      </section>

      <section className="cos-band">
        <div className="cos-section-head">
          <p className="cos-kicker">Mission Types</p>
          <h2>Priorities On The Field</h2>
        </div>
        <div className="cos-missions">
          {missionTypes.map((item) => {
            const Icon = item.icon
            return (
              <article className="cos-mission" key={item.name}>
                <div className="cos-mission__icon"><Icon /></div>
                <h3>{item.name}</h3>
                <p>{item.detail}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="cos-split" id="tools">
        <article>
          <p className="cos-kicker">Cosmic Tools</p>
          <h2>Tool Progression</h2>
          <p>Start cosmic tools with Researchingway after opening Sinus Ardorum. Research data comes from Stellar Missions and is class-specific, but the tool does not need to be equipped while you earn it.</p>
          <p>In Patch 7.51, final-stage tools unlock Tool Mastery Missions on Auxesia. These score-based missions award mastery points, cosmic class score, standings contribution, credits, and Auxesia exploration tokens.</p>
        </article>
        <article>
          <p className="cos-kicker">Auxesia</p>
          <h2>Current Endgame Focus</h2>
          <p>Auxesia adds its own credits, standings, Standard Success entries, exploration tokens, artifact search, and Tool Mastery. Contributions on older stars do not count toward Auxesia standings.</p>
          <p>Artifact Search starts by earning dronebits from Class A missions, EX/EX+ missions, or provisional missions, then exchanging them for drone modules through Kaede.</p>
        </article>
      </section>

      <section className="cos-band" id="currencies">
        <div className="cos-section-head">
          <p className="cos-kicker">Spend Points</p>
          <h2>Currencies And NPCs</h2>
        </div>
        <div className="cos-table" role="table" aria-label="Cosmic Exploration vendors and currencies">
          <div className="cos-table__row is-head" role="row">
            <span>Star</span><span>Reward Exchange</span><span>Fortunes</span><span>Credit / Token Note</span>
          </div>
          {vendors.map((row) => (
            <div className="cos-table__row" role="row" key={row.star}>
              <span>{row.star}</span>
              <span>{row.spender} {row.spendCoords}</span>
              <span>{row.fortune} {row.fortuneCoords}</span>
              <span>{row.credit}. {row.special}.</span>
            </div>
          ))}
        </div>
      </section>

      <section className="cos-sources" aria-label="Sources">
        <span>Sources</span>
        {sources.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer">{source.label}</a>)}
      </section>
    </main>
  )
}

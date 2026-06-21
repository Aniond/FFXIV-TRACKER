import { useState, useEffect, useMemo } from 'react'
import { windowState, fmtDur } from './etWindow.js'
import { itemPath } from './itemCatalog'
import './CraftingJob.css' // We can reuse the CSS for now

const winState = windowState

const CUR_SHORT = (c) => !c ? '' : c
  .replace(/\b(?:Crafters'|Gatherers') Scrip\b/, 'Scrip')
  .replace('Bicolor Gemstone', 'Gemstone')

const I = {
  check:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  chevron:   p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  knife:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 22 17.5 4"/><path d="M17.5 4c1.5 2.5 2 5 0 9s-2 6-1.5 9"/></svg>,
  leaf:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  pick:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 21 13 11"/><path d="M4 9c4-4 12-5 16-2-3-1-7 0-9 2 3-1 6 0 7 2-4-3-11-2-14-2Z"/><path d="m12.5 11.5 2 2"/></svg>,
  fish:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12c3-5 8-6 12-6 3 0 5 2 6 6-1 4-3 6-6 6-4 0-9-1-12-6Z"/><path d="M3 12c-1 1.5-1 3 0 4.5M3 12c-1-1.5-1-3 0-4.5"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/></svg>,
  cart:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  coin:      p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>,
  scrip:     p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h5"/></svg>,
  gem:       p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m12 21-9-12 3-6h12l3 6-9 12Z"/><path d="M3 9h18M9 3 6 9l6 12 6-12-3-6"/></svg>,
  basket:    p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 11 7.5 4h9L19 11"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Z"/><path d="M12 11v8M8 15h8"/></svg>,
  hourglass: p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/></svg>,
  x:         p => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
}

export default function ShoppingListWidget({ list, isOpen, onNavigate, onOpen, onClose, onClear, checkedIngs, onCheckIng }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isOpen) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [isOpen])

  const count = Object.keys(list).length

  const groups = useMemo(() => {
    const craft=[], timed=[], botany=[], mining=[], fishing=[], vendor=[], scrip=[], gemstone=[], market=[], checkedList=[]
    for (const item of Object.values(list)) {
      if (checkedIngs?.has(item.name))   checkedList.push(item)
      else if (item.craftable)            craft.push(item)
      else if (item.window)          timed.push(item)
      else if (item.source==='botany')   botany.push(item)
      else if (item.source==='mining')   mining.push(item)
      else if (item.source==='fishing')  fishing.push(item)
      else if (item.source==='vendor')   vendor.push(item)
      else if (item.source==='scrip')    scrip.push(item)
      else if (item.source==='gemstone') gemstone.push(item)
      else                               market.push(item)
    }
    const ord = { up:0, soon:1, closed:2 }
    timed.sort((a, b) => {
      const wa=winState(a.window), wb=winState(b.window)
      return (ord[wa?.state]??3) - (ord[wb?.state]??3)
    })
    return { craft, timed, botany, mining, fishing, vendor, scrip, gemstone, market, checkedList }
  }, [list, checkedIngs])

  function itemAction(item) {
    return () => onNavigate?.(itemPath(item.name))
  }

  function ShopGroup({ label, iconName, items, isTimed=false }) {
    const IcoEl = I[iconName]
    return (
      <div>
        <div className={`slist__group-hd${isTimed ? ' is-timed' : ''}`}><IcoEl/>{label}</div>
        {items.map(item => {
          const ws = item.window ? winState(item.window) : null
          let dc = item.craftable ? 'var(--dot-craft)'
            : item.source==='market' ? 'var(--dot-market)'
            : item.source==='vendor' ? '#d4a84a'
            : item.source==='scrip' ? 'var(--dot-scrip)'
            : item.source==='gemstone' ? 'var(--dot-gem)'
            : 'var(--dot-avail)'
          if (ws) dc = ws.state==='up' ? 'var(--dot-avail)' : ws.state==='soon' ? 'var(--dot-soon)' : 'var(--dot-closed)'
          const isChecked = checkedIngs?.has(item.name)
          const action = itemAction(item)
          return (
            <div
              className={`slist__item${isChecked ? ' is-checked' : ''}${action ? ' is-link' : ''}`}
              key={item.name}
              role={action ? 'button' : undefined}
              tabIndex={action ? 0 : undefined}
              onClick={action || undefined}
              onKeyDown={action ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action() } } : undefined}
            >
              <span className="chip__cb" role="checkbox" aria-checked={isChecked} onClick={(e) => { e.stopPropagation(); onCheckIng(item.name) }} style={{ marginRight: '8px' }}>
                {isChecked ? <span className="chip__cb-check"><I.check/></span> : <span className="chip__cb-ring"/>}
              </span>
              <span className="slist__item-dot" style={{ background:dc, boxShadow:`0 0 5px ${dc}` }}/>
              <span className="slist__item-name">{item.name}</span>
              {ws ? <span className="slist__item-cd">{ws.pre} {fmtDur(ws.ms)}</span>
                : item.craftable ? <span className="slist__item-cd">craft</span>
                : (item.source==='scrip' || item.source==='gemstone') && item.price != null
                    ? <span className="slist__item-cd">{item.price} {CUR_SHORT(item.currency)}</span>
                : item.source==='vendor' && item.price != null ? <span className="slist__item-cd">{item.price} gil</span>
                : null}
              <span className="slist__item-qty">×{item.qty}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {count > 0 && !isOpen && (
        <div className="slist__fab" onClick={onOpen}>
          <I.basket/>
          <span className="slist__fab-label">Shopping List</span>
          <span className="slist__fab-count">{count}</span>
          <I.chevron className="slist__fab-arrow" style={{ transform:'rotate(180deg)' }}/>
        </div>
      )}
      {isOpen && (
        <div className="slist__overlay" onClick={e => { if (e.target===e.currentTarget) onClose() }}>
          <div className="slist__sheet">
            <div className="slist__hd">
              <span className="slist__title"><I.basket/> Shopping List</span>
              <button className="slist__clear" onClick={onClear}>Clear all</button>
              <button className="slist__close" onClick={onClose}><I.x/></button>
            </div>
            <div className="slist__body">
              {count === 0 ? (
                <div className="slist__empty">Add recipes using the basket button on any card.</div>
              ) : (
                <>
                  {groups.craft.length    > 0 && <ShopGroup label="Craft"               iconName="knife"     items={groups.craft}/>}
                  {groups.timed.length    > 0 && <ShopGroup label="Timed — Gather First" iconName="hourglass" items={groups.timed}  isTimed/>}
                  {groups.botany.length   > 0 && <ShopGroup label="Botany"               iconName="leaf"      items={groups.botany}/>}
                  {groups.mining.length   > 0 && <ShopGroup label="Mining"               iconName="pick"      items={groups.mining}/>}
                  {groups.fishing.length  > 0 && <ShopGroup label="Fishing"              iconName="fish"      items={groups.fishing}/>}
                  {groups.vendor.length   > 0 && <ShopGroup label="Vendor"               iconName="coin"      items={groups.vendor}/>}
                  {groups.scrip.length    > 0 && <ShopGroup label="Scrip Exchange"       iconName="scrip"     items={groups.scrip}/>}
                  {groups.gemstone.length > 0 && <ShopGroup label="Bicolor Gemstone"     iconName="gem"       items={groups.gemstone}/>}
                  {groups.market.length   > 0 && <ShopGroup label="Market Board"         iconName="cart"      items={groups.market}/>}
                  {groups.checkedList.length > 0 && <ShopGroup label="Checked Off"       iconName="check"     items={groups.checkedList}/>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

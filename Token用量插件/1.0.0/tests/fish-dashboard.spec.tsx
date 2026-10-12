// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { UsageStatsSection, type UsageStatsSectionProps } from '../src/client/index.tsx'
import { zh } from '../src/client/locales.ts'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('keeps the heatmap and token bars but removes the rate line, axis and legend', async () => {
  vi.stubGlobal('ResizeObserver', class { observe(){} disconnect(){} unobserve(){} })
  const value={from:'2026-10-11',to:'2026-10-12',tokens:100,requests:1,turns:1,cacheHit:70,cacheMiss:20,activeDays:1,topModel:'p/m',topProvider:'p',
    daily:[{day:'2026-10-12',total:100,byModel:{'p/m':100},byProvider:{p:100},requests:1,turns:1,cacheHit:70,cacheMiss:20}],
    models:[{model:'p/m',provider:'p',tokens:100,percent:100}],providers:[{provider:'p',tokens:100,percent:100}]}
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({ok:true,value})})))
  const t=((key:string)=>key) as UsageStatsSectionProps['t']
  render(<UsageStatsSection {...({t} as UsageStatsSectionProps)} />)
  await waitFor(()=>expect(screen.getByRole('img',{name:'dailyTrend'})).toBeTruthy())
  const chart=screen.getByRole('img',{name:'dailyTrend'})
  expect(chart.querySelectorAll('rect').length).toBeGreaterThan(0)
  expect(chart.querySelector('path')).toBeNull()
  expect(chart.querySelector('circle')).toBeNull()
  expect(chart.textContent).not.toContain('%')
  expect(screen.queryByText('hitRateLegend')).toBeNull()
  expect(screen.getByRole('img',{name:'heatmap'})).toBeTruthy()
  expect(screen.getByAltText('Token usage').getAttribute('src')).toBe('usage/api/brand')
  expect(zh.sessions).toBe('已结束轮次')
})

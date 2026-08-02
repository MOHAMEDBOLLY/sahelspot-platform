import { describe, expect, it } from 'vitest'
import { buildWhatsappHref } from './externalLinks'

describe('buildWhatsappHref', () => {
  it('converts an 11-digit Egyptian local number to E.164 digits', () => {
    expect(buildWhatsappHref('01001234567')).toBe('https://wa.me/201001234567')
  })

  it('strips formatting characters before normalizing', () => {
    expect(buildWhatsappHref('010-012-34567')).toBe('https://wa.me/201001234567')
  })

  it('passes through a number that already has a country code', () => {
    expect(buildWhatsappHref('+201001234567')).toBe('https://wa.me/201001234567')
  })

  it('passes through a non-Egyptian-shaped number unchanged', () => {
    expect(buildWhatsappHref('12025550123')).toBe('https://wa.me/12025550123')
  })

  it('returns null for empty or missing input', () => {
    expect(buildWhatsappHref(null)).toBeNull()
    expect(buildWhatsappHref(undefined)).toBeNull()
    expect(buildWhatsappHref('')).toBeNull()
    expect(buildWhatsappHref('   ')).toBeNull()
  })
})

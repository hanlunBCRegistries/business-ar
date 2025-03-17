// YourComponent.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { createTestingPinia } from '@pinia/testing'
import BusinessEmail from '~/components/content/BusinessEmail.vue'
import { useBusinessStore, useAccountStore } from '#imports'
import { mockNewAccount } from '~/tests/mocks/mockedData'

// Simplified mocks
vi.mock('~/stores/tos', () => ({
  useTosStore: () => ({
    getTermsOfUse: vi.fn().mockResolvedValue({ isTermsOfUseAccepted: true })
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('<BusinessEmail />', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({
      stubActions: false,
      initialState: {
        account: { currentAccount: null },
        business: { currentBusiness: null }
      }
    })
  })

  const renderComponent = () =>
    renderSuspended(BusinessEmail, {
      global: { plugins: [pinia] }
    })

  it('displays account email when available', async () => {
    const accountStore = useAccountStore(pinia)
    const businessStore = useBusinessStore(pinia)

    accountStore.$patch({
      currentAccount: {
        ...mockNewAccount,
        contacts: [{ email: 'account@test.com' }]
      }
    })
    businessStore.$patch({ currentBusiness: {} })

    const { getByText } = await renderComponent()
    expect(getByText('account@test.com')).toBeTruthy()
  })

  it('displays business invitation email when no account email', async () => {
    const businessStore = useBusinessStore(pinia)
    businessStore.$patch({
      currentBusiness: { invitationEmail: 'business@test.com' }
    })

    const { getByText } = await renderComponent()
    expect(getByText('business@test.com')).toBeTruthy()
  })

  it('shows fallback when no emails found', async () => {
    const { getByText } = await renderComponent()
    expect(getByText('No email found')).toBeTruthy()
  })
})

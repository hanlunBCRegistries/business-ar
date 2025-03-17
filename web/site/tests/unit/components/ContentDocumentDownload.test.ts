import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderSuspended } from '@nuxt/test-utils/runtime'
import { fireEvent, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { mockedArFilingResponse } from '~/tests/mocks/mockedData'
import DocumentDownload from '~/components/content/DocumentDownload.vue'

// Mock TOS store to prevent middleware errors
vi.mock('~/stores/tos', () => ({
  useTosStore: () => ({
    getTermsOfUse: vi.fn().mockResolvedValue({ isTermsOfUseAccepted: true })
  })
}))

// Mock i18n to prevent setup errors
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('<DocumentDownload />', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({
      stubActions: true,
      initialState: {
        annualReport: { arFiling: null }
      }
    })
  })

  const renderComponent = () =>
    renderSuspended(DocumentDownload, {
      global: { plugins: [pinia] }
    })

  it('renders download buttons for documents', async () => {
    const store = useAnnualReportStore(pinia)
    store.arFiling = {
      filing: {
        ...mockedArFilingResponse.filing,
        documents: [
          { name: 'Receipt', url: 'receipt-url' },
          { name: 'Report', url: 'report-url' }
        ]
      }
    }

    await renderComponent()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].textContent).toContain('Download Receipt')
    expect(buttons[1].textContent).toContain('Download Report')
  })

  it('only renders whats in the store', async () => {
    const store = useAnnualReportStore(pinia)
    store.arFiling = {
      filing: {
        ...mockedArFilingResponse.filing,
        documents: [
          { name: 'Receipt', url: 'receipt-url' }
        ]
      }
    }

    await renderComponent()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toContain('Download Receipt')
  })

  it('wont render any buttons in an empty store', async () => {
    const store = useAnnualReportStore(pinia)
    store.arFiling = mockedArFilingResponse

    await renderComponent()
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  it('calls handleDocumentDownload on button click', async () => {
    const store = useAnnualReportStore(pinia)
    store.arFiling = {
      filing: {
        ...mockedArFilingResponse.filing,
        documents: [
          { name: 'Receipt', url: 'receipt-url' },
          { name: 'Report', url: 'report-url' }
        ]
      }
    }
    store.handleDocumentDownload = vi.fn()

    await renderComponent()
    const buttons = screen.getAllByRole('button')
    await fireEvent.click(buttons[0])

    expect(store.handleDocumentDownload).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Receipt', url: 'receipt-url' })
    )
  })
})

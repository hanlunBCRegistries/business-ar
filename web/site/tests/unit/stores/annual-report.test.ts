import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { useAnnualReportStore, useAlertStore } from '#imports'

// All vi.mock calls need to be at the top, before any imports
vi.mock('~/stores/tos', () => ({
  useTosStore: () => ({
    getTermsOfUse: vi.fn().mockResolvedValue({
      isTermsOfUseAccepted: true,
      termsOfUseCurrentVersion: '1'
    })
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

// Mock useBarApi to return the expected response
vi.mock('~/composables/useBarApi', () => ({
  useBarApi: vi.fn().mockResolvedValue({
    filing: {
      annualReport: {
        annualGeneralMeetingDate: '2024-04-30',
        annualReportDate: '2024-04-30',
        votedForNoAGM: false,
        unanimousResolutionDate: null
      },
      header: {
        certifiedBy: 'some user',
        certifiedByDisplayName: 'STING',
        colinIds: [123, 456, 789],
        date: '2024-04-30',
        completionDate: null,
        filingDateTime: '2024-04-30',
        filingYear: 2024,
        id: 1,
        name: 'Annual Report',
        paymentStatus: 'PAID',
        paymentAccount: '1',
        paymentToken: 123456,
        status: 'Submitted',
        submitter: null
      },
      documents: []
    }
  })
}))

describe('Annual Report Store Tests', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  beforeEach(() => {
    pinia = createTestingPinia({
      stubActions: false, // Change to false to allow actions to execute
      initialState: {
        business: {
          businessNano: {
            identifier: '123',
            legalName: 'Test inc',
            legalType: 'BC',
            taxId: null
          }
        },
        account: {
          currentAccount: {
            id: 123,
            token: '123'
          }
        }
      }
    })
    setActivePinia(pinia)
  })

  it('inits the store with empty values', () => {
    const arStore = useAnnualReportStore()

    expect(arStore.loading).toEqual(false)
    expect(arStore.arFiling).toEqual({})
  })

  it('creates ar filing, assigns store value and returns paymentToken and filingId', async () => {
    const arStore = useAnnualReportStore()

    // Submit filing
    const result = await arStore.submitAnnualReportFiling({
      agmDate: '2022-10-10',
      votedForNoAGM: false,
      unanimousResolutionDate: null
    })

    // assert
    expect(arStore.arFiling).toBeDefined()
    expect(result.paymentToken).toBe(123456)
    expect(result.filingId).toBe(1)
  })

  it('will add filing id to end of submitAnnualReport url if a filing currently exists', async () => {
    const arStore = useAnnualReportStore()

    // Set initial filing
    arStore.arFiling = {
      filing: {
        annualReport: {
          annualGeneralMeetingDate: '2024-04-30',
          annualReportDate: '2024-04-30',
          votedForNoAGM: false,
          unanimousResolutionDate: null
        },
        header: {
          id: 1,
          paymentToken: 123456,
          status: 'Submitted'
        },
        documents: []
      }
    }

    expect(Object.keys(arStore.arFiling).length).toBeGreaterThan(0)

    // First call
    const result1 = await arStore.submitAnnualReportFiling({
      agmDate: '2022-10-10',
      votedForNoAGM: false,
      unanimousResolutionDate: null
    })

    // Check result1 exists
    expect(result1).toBeDefined()

    // Second call
    const result2 = await arStore.submitAnnualReportFiling({
      agmDate: '2022-10-10',
      votedForNoAGM: false,
      unanimousResolutionDate: null
    })

    // Check result2 exists before destructuring
    expect(result2).toBeDefined()

    // assert
    expect(result2.paymentToken).toBe(123456)
    expect(result2.filingId).toBe(1)
  })

  it('can reset the store values', () => {
    const arStore = useAnnualReportStore()
    arStore.arFiling = {
      filing: {
        annualReport: {
          annualGeneralMeetingDate: '2024-04-30',
          annualReportDate: '2024-04-30',
          votedForNoAGM: false,
          unanimousResolutionDate: null
        },
        header: {
          id: 1,
          paymentToken: 123456,
          status: 'Submitted'
        },
        documents: []
      }
    }
    arStore.loading = false

    expect(Object.keys(arStore.arFiling).length).toBeGreaterThan(0)

    arStore.$reset()

    expect(Object.keys(arStore.arFiling).length).toBe(0)
  })

  describe('handleDocumentDownload', () => {
    let createObjectURLSpy, revokeObjectURLSpy, appendChildSpy, removeChildSpy, clickSpy

    beforeEach(() => {
      createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:url')
      revokeObjectURLSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {})
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(node => node)
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(node => node)
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      vi.useFakeTimers()

      // Mock Nuxt app with keycloak
      vi.mock('#app', () => ({
        useNuxtApp: () => ({
          $keycloak: {
            token: '123'
          }
        })
      }), { virtual: true })
    })

    afterEach(() => {
      vi.clearAllMocks()
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })

    it('should download the file and call window/document events/methods', async () => {
      const arStore = useAnnualReportStore()

      // Use global fetch instead of stubGlobal
      global.$fetch = vi.fn().mockResolvedValue(new Blob(['test content'], { type: 'application/pdf' }))

      const file = { name: 'Report', url: '/path/to/file' }
      const alertStore = useAlertStore(pinia)
      vi.spyOn(alertStore, 'addAlert')

      await arStore.handleDocumentDownload(file)

      expect(global.$fetch).toHaveBeenCalledWith(
        '/path/to/file',
        { responseType: 'blob', headers: { Authorization: 'Bearer 123' } }
      )
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(appendChildSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      vi.runAllTimers()
      expect(removeChildSpy).toHaveBeenCalled()
      expect(revokeObjectURLSpy).toHaveBeenCalled()
    })

    it('should show an error alert if the download fails', async () => {
      const arStore = useAnnualReportStore()
      const alertStore = useAlertStore(pinia)
      vi.spyOn(alertStore, 'addAlert')

      // Use global fetch instead of stubGlobal
      global.$fetch = vi.fn().mockRejectedValue(new Error('Failed'))

      await arStore.handleDocumentDownload({
        name: 'Report',
        url: '/path/to/file'
      })

      expect(alertStore.addAlert).toHaveBeenCalledWith({
        severity: 'error',
        category: 'document-download'
      })
    })
  })
})

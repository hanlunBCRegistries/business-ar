import { describe, expect, it, beforeEach, vi } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { setActivePinia, createPinia } from 'pinia'
import { usePayFeesStore, AlertCategory } from '#imports'
import { mockFeeInfo, mockFilingData } from '~/tests/mocks/mockedData'

// All vi.mock calls need to be at the top, before any imports
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('~/stores/account', () => ({
  useAccountStore: () => ({
    currentAccount: { id: 123, token: '123' },
    userAccounts: [{ id: 1, name: 'Test Account' }]
  })
}))

// Create a mock function for addAlert that we can spy on later
const mockAddAlert = vi.fn()

vi.mock('~/stores/alert', () => ({
  useAlertStore: () => ({
    alerts: [],
    addAlert: mockAddAlert
  })
}))

// Mock useBarApi to throw an error for the specific endpoint
vi.mock('~/composables/useBarApi', () => ({
  useBarApi: vi.fn().mockImplementation((url) => {
    if (url.includes('/fees/')) {
      throw new Error('some-error')
    }
    return {}
  })
}))

describe('Pay Fees Store Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Reset the mock before each test
    mockAddAlert.mockClear()
  })

  it('inits the store with empty values', () => {
    const feeStore = usePayFeesStore()

    expect(feeStore.fees).toEqual([])
    expect(feeStore.folioNumber).toBe('')
    expect(feeStore.feeInfo).toEqual([])
  })

  it('adds a new fee to the store', () => {
    const feeStore = usePayFeesStore()

    feeStore.addFee(mockFeeInfo)

    expect(feeStore.fees.length).toBe(1)
    expect(feeStore.fees[0]).toEqual(expect.objectContaining(mockFeeInfo))
  })

  it('adds an existing fee to the store and increases its count', () => {
    const feeStore = usePayFeesStore()

    feeStore.addFee(mockFeeInfo)
    feeStore.addFee(mockFeeInfo)

    expect(feeStore.fees.length).toBe(1)
    expect(feeStore.fees[0].quantity).toBe(2)
  })

  it('removes a fee from the store', () => {
    const feeStore = usePayFeesStore()

    feeStore.addFee(mockFeeInfo)
    feeStore.removeFee(mockFeeInfo)

    expect(feeStore.fees.length).toBe(0)
  })

  it('removes an existing fee from the store and decreases its count', () => {
    const feeStore = usePayFeesStore()

    feeStore.addFee(mockFeeInfo)
    feeStore.addFee(mockFeeInfo) // quantity should be 2
    feeStore.removeFee(mockFeeInfo)

    expect(feeStore.fees.length).toBe(1)
  })

  it('loads fee types and charges into the store', async () => {
    const store = usePayFeesStore()
    registerEndpoint('/fees/Example Entity Type/FTC001?priority=true', () => mockFeeInfo)

    await store.loadFeeTypesAndCharges('123456', [mockFilingData])

    expect(store.feeInfo.length).toBe(1)
  })

  it('gets fee information from the store', async () => {
    const store = usePayFeesStore()
    registerEndpoint('/fees/Example Entity Type/FTC001?priority=true', () => mockFeeInfo)

    await store.loadFeeTypesAndCharges('123456', [mockFilingData])

    const feeInfo = await store.getFeeInfo(mockFilingData)

    expect(feeInfo).toEqual(expect.objectContaining(mockFeeInfo))
  })

  it('does not add invalid fee', () => {
    const feeStore = usePayFeesStore()
    const invalidFeeInfo = { ...mockFeeInfo, total: null }

    // @ts-ignore
    feeStore.addFee(invalidFeeInfo)

    expect(feeStore.fees.length).toBe(0)
  })

  it('will add an alert if theres an error in addPayFees', async () => {
    const feeStore = usePayFeesStore()

    try {
      await feeStore.addPayFees('BCANN')
    } catch (error) {
      // Expected error
    }

    expect(mockAddAlert).toHaveBeenCalledWith({
      severity: 'error',
      category: AlertCategory.FEE_INFO
    })
  })

  it('resets the store to its initial state', () => {
    const feeStore = usePayFeesStore()

    feeStore.addFee(mockFeeInfo)
    feeStore.folioNumber = '123456'

    feeStore.$reset()

    expect(feeStore.fees).toEqual([])
    expect(feeStore.folioNumber).toBe('')
    expect(feeStore.feeInfo).toEqual([])
  })
})

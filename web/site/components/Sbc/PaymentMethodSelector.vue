<script setup lang="ts">
import { usePayFeesStore } from '~/stores/pay-fees'

const payFeesStore = usePayFeesStore()
</script>

<template>
  <div v-if="payFeesStore.allowAlternatePaymentMethod">
    <UCard>
      <template #header>
        <span class="text-white">{{ $t('widgets.feeSummary.paymentMethod') }}</span>
      </template>

      <div class="p-4">
        <URadio
          v-for="method in payFeesStore.allowedPaymentMethods"
          :key="method.value"
          v-model="payFeesStore.userSelectedPaymentMethod"
          :value="method.value"
          :label="method.label"
          name="payment-method"
        />
      </div>
    </UCard>
  </div>
</template>

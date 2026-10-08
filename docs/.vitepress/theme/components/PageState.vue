<template>
  <div class="rd-state" :role="kind === 'error' ? 'alert' : 'status'" :aria-busy="kind === 'loading'">
    <LoaderCircle v-if="kind === 'loading'" class="rd-spinner" :size="24" aria-hidden="true" />
    <CircleAlert v-else-if="kind === 'error'" :size="24" aria-hidden="true" />
    <Inbox v-else :size="24" aria-hidden="true" />
    <h3>{{ title }}</h3><p v-if="message">{{ message }}</p><slot />
  </div>
</template>
<script setup>
import { CircleAlert, Inbox, LoaderCircle } from 'lucide-vue-next'
defineProps({ kind: { type: String, default: 'empty' }, title: String, message: String })
</script>

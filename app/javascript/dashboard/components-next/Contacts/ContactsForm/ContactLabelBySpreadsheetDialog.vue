<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import { useAlert } from 'dashboard/composables';
import ContactAPI from 'dashboard/api/contacts';
import {
  readCustomerList,
  slugifyLabel,
  buildNotFoundCsv,
} from 'dashboard/helper/customerListSpreadsheet';

import Dialog from 'dashboard/components-next/dialog/Dialog.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';

const { t } = useI18n();
const store = useStore();
const labels = useMapGetter('labels/getLabels');

const dialogRef = ref(null);
const fileInput = ref(null);
const fileName = ref('');
const parsed = ref(null);
const parseError = ref('');
const labelName = ref('');
const isReading = ref(false);
const isApplying = ref(false);
const result = ref(null);

const labelSlug = computed(() => slugifyLabel(labelName.value));
const labelExists = computed(() =>
  (labels.value || []).some(label => label.title === labelSlug.value)
);
const labelHint = computed(() => {
  if (!labelSlug.value) return '';
  const params = { label: labelSlug.value };
  return labelExists.value
    ? t(
        'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.LABEL_EXISTING',
        params
      )
    : t(
        'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.LABEL_NEW',
        params
      );
});
const customersCount = computed(() => parsed.value?.customers.length || 0);
const canApply = computed(
  () => customersCount.value > 0 && !!labelSlug.value && !isApplying.value
);

const reset = () => {
  fileName.value = '';
  parsed.value = null;
  parseError.value = '';
  labelName.value = '';
  result.value = null;
  if (fileInput.value) fileInput.value.value = null;
};

const handleFileClick = () => fileInput.value?.click();

const handleFileChange = async () => {
  const file = fileInput.value?.files[0];
  parsed.value = null;
  parseError.value = '';
  result.value = null;
  if (!file) return;

  fileName.value = file.name;
  isReading.value = true;
  try {
    parsed.value = await readCustomerList(file);
    if (!parsed.value.customers.length) {
      parseError.value = t(
        'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.ERRORS.NO_ROWS'
      );
    }
  } catch (error) {
    parseError.value =
      error.message === 'UNSUPPORTED_FORMAT'
        ? t(
            'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.ERRORS.UNSUPPORTED_FORMAT'
          )
        : t(
            'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.ERRORS.READ_FAILED'
          );
  } finally {
    isReading.value = false;
  }
};

const apply = async () => {
  if (result.value) {
    dialogRef.value?.close();
    return;
  }
  if (!canApply.value) return;

  isApplying.value = true;
  try {
    // Only codes and phones are sent: names and documents stay in the browser.
    const { data } = await ContactAPI.bulkLabelByCodes({
      label: labelSlug.value,
      rows: parsed.value.customers,
    });
    result.value = data;
    store.dispatch('labels/get');
  } catch (error) {
    useAlert(
      error?.response?.data?.message ||
        t('CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.ERRORS.API')
    );
  } finally {
    isApplying.value = false;
  }
};

const downloadNotFound = () => {
  const blob = new Blob([buildNotFoundCsv(result.value.not_found_codes)], {
    type: 'text/csv;charset=utf-8',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `nao-encontrados-${result.value.label}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const open = () => {
  reset();
  dialogRef.value?.open();
};

defineExpose({ dialogRef, open });
</script>

<template>
  <Dialog
    ref="dialogRef"
    :title="t('CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.TITLE')"
    :description="
      t('CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.DESCRIPTION')
    "
    :confirm-button-label="
      result
        ? t('CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.CLOSE')
        : t('CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.APPLY')
    "
    :show-cancel-button="!result"
    :is-loading="isApplying"
    :disable-confirm-button="!result && !canApply"
    @confirm="apply"
  >
    <div v-if="!result" class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm truncate text-n-slate-12">
          {{
            fileName ||
            t('CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.NO_FILE')
          }}
        </span>
        <Button
          :label="
            fileName
              ? t(
                  'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.CHANGE_FILE'
                )
              : t(
                  'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.CHOOSE_FILE'
                )
          "
          icon="i-lucide-upload"
          color="slate"
          variant="ghost"
          size="sm"
          class="!w-fit"
          :is-loading="isReading"
          type="button"
          data-test-id="choose-file"
          @click="handleFileClick"
        />
      </div>

      <p
        v-if="parseError"
        class="mb-0 text-sm text-n-ruby-11"
        data-test-id="parse-error"
      >
        {{ parseError }}
      </p>
      <p
        v-else-if="customersCount"
        class="mb-0 text-sm text-n-slate-11"
        data-test-id="preview"
      >
        {{
          t('CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.PREVIEW', {
            total: customersCount,
            withCode: parsed.withCode,
            phoneOnly: parsed.phoneOnly,
          })
        }}
      </p>

      <Input
        v-model="labelName"
        :label="
          t('CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.LABEL_NAME')
        "
        :placeholder="
          t(
            'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.LABEL_PLACEHOLDER'
          )
        "
        :message="labelHint"
        list="label-by-spreadsheet-options"
        data-test-id="label-input"
      />
      <datalist id="label-by-spreadsheet-options">
        <option
          v-for="label in labels || []"
          :key="label.id"
          :value="label.title"
        />
      </datalist>
    </div>

    <div v-else class="flex flex-col gap-3 text-sm" data-test-id="result">
      <p class="mb-0 text-n-slate-12">
        {{
          t(
            'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.RESULT.SUMMARY',
            {
              matched: result.matched,
              received: result.received,
              label: result.label,
            }
          )
        }}
      </p>
      <ul
        class="flex flex-col gap-1 mb-0 list-none ltr:pl-0 rtl:pr-0 text-n-slate-11"
      >
        <li v-if="result.labeled">
          {{
            t(
              'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.RESULT.LABELED',
              { count: result.labeled }
            )
          }}
        </li>
        <li v-if="result.queued">
          {{
            t(
              'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.RESULT.QUEUED',
              { count: result.queued }
            )
          }}
        </li>
        <li v-if="result.already_labeled">
          {{
            t(
              'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.RESULT.ALREADY_LABELED',
              {
                count: result.already_labeled,
              }
            )
          }}
        </li>
        <li v-if="result.not_found">
          {{
            t(
              'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.RESULT.NOT_FOUND',
              { count: result.not_found }
            )
          }}
        </li>
      </ul>
      <Button
        v-if="result.not_found"
        :label="
          t(
            'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.RESULT.DOWNLOAD_NOT_FOUND'
          )
        "
        icon="i-lucide-download"
        color="slate"
        variant="ghost"
        size="sm"
        class="!w-fit"
        type="button"
        data-test-id="download-not-found"
        @click="downloadNotFound"
      />
      <p class="mb-0 text-n-slate-11">
        {{
          t(
            'CONTACTS_LAYOUT.HEADER.ACTIONS.LABEL_BY_SPREADSHEET.RESULT.CAMPAIGN_HINT',
            { label: result.label }
          )
        }}
      </p>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
      class="hidden"
      data-test-id="file-input"
      @change="handleFileChange"
    />
  </Dialog>
</template>

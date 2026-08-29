/**
 * Визард «Добавить авто» — порт features/garage/add-car/* (sct-web), приведён
 * к дизайну screens/add-car. Шаги: Марка → Модель → Поколение →
 * Характеристики → Номер.
 *
 * Структура по макету:
 *   - верх: прогресс-бар + «‹ N. Название шага» (шаг назад) + «Ввести VIN код»;
 *   - тело: белая карточка с контентом шага;
 *   - шаг «Поколение» сужает выборку по году/кузову/поколению через
 *     /cars/filters/; шаг «Характеристики» — chip-фильтры (топливо/объём/
 *     мощность/КПП/привод/руль) + сетка подходящих авто + «Выбрать авто».
 *   - VIN вводится опционально заранее (модалка) и подставляется в финал.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Ionicons } from '@expo/vector-icons'
import { RequireAuth } from '@/shared/ui/RequireAuth'
import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { BottomBar } from '@/shared/ui/BottomBar'
import { Modal } from '@/shared/ui/Modal'
import { Spinner } from '@/shared/ui/Spinner'
import { SafeImage } from '@/shared/ui/SafeImage'
import { cn } from '@/shared/lib/cn'
import { formatEngineVolume } from '@/shared/lib/format'
import { useCreateCarMutation } from '@/features/garage/queries'
import { parseApiError } from '@/features/auth/errors'
import {
  LICENSE_PLATE_ERROR,
  isValidLicensePlate,
  normalizeLicensePlate,
} from '@/shared/lib/license-plate'
import {
  useFiltersQuery,
  useMarksQuery,
  useModelsQuery,
  useModificationsQuery,
  useTrimsQuery,
} from '@/features/garage/add-car/queries'
import type {
  CarsQuery,
  CodeNameOption,
  Mark,
  Model,
  Modification,
  Trim,
} from '@/features/garage/add-car/types'

/** Параметры сужения (год/кузов/поколение + характеристики) — как web SpecsValues. */
interface SpecsValues {
  year?: number
  body_type?: number
  generation?: number
  fuel_type?: string
  engine_volume?: number
  horse_power?: number
  transmission_type?: string
  drive_type?: string
  steering_wheel_position?: string
}

const STEPS = ['Марка', 'Модель', 'Поколение', 'Характеристики', 'Комплектация', 'Номер']

export default function AddCarScreen() {
  return (
    <RequireAuth>
      <AddCarWizard />
    </RequireAuth>
  )
}

function AddCarWizard() {
  const router = useRouter()
  const createCar = useCreateCarMutation()
  const [step, setStep] = useState(0)
  const [mark, setMark] = useState<Mark | null>(null)
  const [model, setModel] = useState<Model | null>(null)
  const [specs, setSpecs] = useState<SpecsValues>({})
  const [modification, setModification] = useState<Modification | null>(null)
  const [trim, setTrim] = useState<Trim | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  // VIN — опционально заранее, подставляется в финальную форму.
  const [vin, setVin] = useState('')
  const [vinDraft, setVinDraft] = useState('')
  const [vinOpen, setVinOpen] = useState(false)

  // Одна комплектация → шаг «Комплектация» проскакивается (TrimPicker сам её
  // выбирает), поэтому «назад» с «Номера» ведёт сразу на «Характеристики».
  const singleTrim = modification?.trims_count === 1

  const onBack = () => {
    if (step === 5 && singleTrim) {
      setStep(3)
      return
    }
    if (step > 0) setStep((s) => Math.max(0, s - 1))
    else router.back()
  }

  const onPickMark = (m: Mark) => {
    if (mark?.id !== m.id) {
      setModel(null)
      setSpecs({})
      setModification(null)
      setTrim(null)
    }
    setMark(m)
    setStep(1)
  }
  const onPickModel = (m: Model) => {
    if (model?.id !== m.id) {
      setSpecs({})
      setModification(null)
      setTrim(null)
    }
    setModel(m)
    setStep(2)
  }
  const onChangeSpecs = (next: SpecsValues) => {
    setSpecs(next)
    setModification(null)
    setTrim(null)
  }
  const onPickMod = (m: Modification) => {
    if (modification?.id !== m.id) setTrim(null)
    setModification(m)
  }
  const confirmMod = () => {
    if (modification) setStep(4)
  }
  const onPickTrim = (t: Trim) => {
    setTrim(t)
    setStep(5)
  }

  const submit = async (v: FinalValues) => {
    if (!trim) return
    setServerError(null)
    try {
      await createCar.mutateAsync({
        modification_trim_source_id: trim.source_id,
        license_plate: normalizeLicensePlate(v.license_plate),
        vin_code: v.vin_code?.trim().toUpperCase() ?? '',
        mileage_km: null,
        is_default: true,
        // Год со шага «Поколение» — заказчик ждёт в гараже именно его,
        // а не год начала поколения.
        production_year: specs.year ?? null,
      })
      router.replace('/garage')
    } catch (err) {
      const parsed = parseApiError(err, 'Не удалось сохранить автомобиль.')
      const msgs = [parsed.general, ...Object.values(parsed.fields)].filter(Boolean) as string[]
      setServerError(msgs.join(' ') || 'Не удалось сохранить автомобиль.')
    }
  }

  return (
    <View className="flex-1 bg-surfaceLight">
      <Stack.Screen options={{ headerShown: false }} />

      <WizardHeader
        step={step}
        onBack={onBack}
        onVin={() => {
          setVinDraft(vin)
          setVinOpen(true)
        }}
      />

      {step === 0 ? (
        <MarkPicker selectedId={mark?.id ?? null} onSelect={onPickMark} vin={vin} onVin={setVin} />
      ) : null}
      {step === 1 && mark ? (
        <ModelPicker markId={mark.id} selectedId={model?.id ?? null} onSelect={onPickModel} />
      ) : null}
      {step === 2 && mark && model ? (
        <SpecsPicker
          markId={mark.id}
          modelId={model.id}
          values={specs}
          onChange={onChangeSpecs}
          onContinue={() => setStep(3)}
        />
      ) : null}
      {step === 3 && mark && model ? (
        <ModificationPicker
          markId={mark.id}
          modelId={model.id}
          specs={specs}
          onChangeSpecs={onChangeSpecs}
          selectedId={modification?.id ?? null}
          onSelect={onPickMod}
          onConfirm={confirmMod}
        />
      ) : null}
      {step === 4 && modification ? (
        <TrimPicker
          modificationId={modification.id}
          selectedTrimSourceId={trim?.source_id ?? null}
          onSelect={onPickTrim}
        />
      ) : null}
      {step === 5 && trim ? (
        <FinalForm defaultVin={vin} onSubmit={submit} serverError={serverError} />
      ) : null}

      <Modal open={vinOpen} onClose={() => setVinOpen(false)} title="VIN код">
        <Input
          label="Введите VIN код (необязательно)"
          placeholder="VIN код"
          autoCapitalize="characters"
          maxLength={17}
          value={vinDraft}
          onChangeText={(t) => setVinDraft(t.toUpperCase())}
        />
        <View className="mt-5">
          <Button
            fullWidth
            onPress={() => {
              setVin(vinDraft)
              setVinOpen(false)
            }}
          >
            Подтвердить
          </Button>
        </View>
      </Modal>
    </View>
  )
}

// --- Верхняя панель: прогресс + «‹ N. Шаг» + кнопка VIN ---
function WizardHeader({ step, onBack, onVin }: { step: number; onBack: () => void; onVin: () => void }) {
  const insets = useSafeAreaInsets()
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <View style={{ paddingTop: insets.top + 8 }} className="gap-3 px-4 pb-3">
      <View className="h-1.5 overflow-hidden rounded-full bg-surfaceMuted">
        <View className="h-full rounded-full bg-brandYellow" style={{ width: `${progress}%` }} />
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <Pressable onPress={onBack} hitSlop={8} className="flex-row items-center gap-2">
          <Ionicons name="chevron-back" size={24} color="#18202A" />
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase tracking-tight text-textPrimary">
            {step + 1}. {STEPS[step]}
          </Text>
        </Pressable>
      </View>

      {step <= 2 ? (
        <Pressable onPress={onVin} className="self-start rounded-sct bg-brandBlue px-6 py-3 active:opacity-90">
          <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[12px] uppercase tracking-widest text-white">
            Ввести VIN код
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

// --- Шаг 1: Марка ---
function MarkPicker({
  selectedId,
  onSelect,
  vin,
  onVin,
}: {
  selectedId: number | null
  onSelect: (m: Mark) => void
  vin: string
  onVin: (v: string) => void
}) {
  const { data, isLoading, isError } = useMarksQuery()
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const q = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    const all = data?.results ?? []
    if (!q) return all
    return all.filter((m) => [m.name, m.name_ru, m.display_name].some((v) => v?.toLowerCase().includes(q)))
  }, [data, q])
  const popular = useMemo(() => filtered.filter((m) => m.is_popular), [filtered])
  const base = popular.length > 0 ? popular : filtered
  const visible = q || showAll ? filtered : base.slice(0, 12)
  const canExpand = !q && !showAll && filtered.length > visible.length

  if (isLoading) return <Centered><Spinner /></Centered>
  if (isError || !data) return <ErrorPlate text="Не удалось загрузить список марок." />

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <StepCard>
        <Input
          label="Введите VIN код (необязательно)"
          placeholder="VIN код"
          autoCapitalize="characters"
          maxLength={17}
          value={vin}
          onChangeText={(t) => onVin(t.toUpperCase())}
        />
        <Input label="Поиск марки" placeholder="Например BMW…" value={search} onChangeText={setSearch} autoCapitalize="none" />

        <View className="flex-row flex-wrap gap-2">
          {visible.map((mark) => (
            <Pressable
              key={mark.id}
              onPress={() => onSelect(mark)}
              className={cn(
                'w-[31%] items-center gap-2 rounded-sct border bg-white p-3',
                mark.id === selectedId ? 'border-brandBlue' : 'border-borderLight',
              )}
            >
              <SafeImage
                uri={mark.logo_url}
                resizeMode="contain"
                className="h-10 w-10"
                fallback={
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-surfaceLight">
                    <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[11px] uppercase text-textSecondary">
                      {mark.name.slice(0, 2)}
                    </Text>
                  </View>
                }
              />
              <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="text-[11px] uppercase text-textPrimary">
                {mark.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 ? <ErrorPlate text={`По запросу «${search}» марки не найдены.`} muted /> : null}
        {canExpand ? (
          <Pressable onPress={() => setShowAll(true)} className="items-center rounded-sct border-2 border-dashed border-borderLight py-4">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[12px] uppercase tracking-widest text-textSecondary">
              Показать все марки
            </Text>
          </Pressable>
        ) : null}
      </StepCard>
    </ScrollView>
  )
}

// --- Шаг 2: Модель ---
function ModelPicker({ markId, selectedId, onSelect }: { markId: number; selectedId: number | null; onSelect: (m: Model) => void }) {
  const { data, isLoading, isError } = useModelsQuery(markId)
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    const all = data?.results ?? []
    if (!q) return all
    return all.filter((m) => [m.name, m.name_ru, m.display_name].some((v) => v?.toLowerCase().includes(q)))
  }, [data, q])
  const visible = q || showAll ? filtered : filtered.slice(0, 8)
  const canExpand = !q && !showAll && filtered.length > visible.length

  if (isLoading) return <Centered><Spinner /></Centered>
  if (isError || !data) return <ErrorPlate text="Не удалось загрузить модели." />

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <StepCard>
        <Input label="Выбор модели" placeholder="Начните вводить модель…" value={search} onChangeText={setSearch} autoCapitalize="none" />

        <View className="flex-row flex-wrap gap-2">
          {visible.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => onSelect(m)}
              className={cn(
                'w-[48%] rounded-sct border bg-white p-4',
                m.id === selectedId ? 'border-brandBlue bg-blue-50' : 'border-borderLight',
              )}
            >
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-sm uppercase text-textPrimary">{m.name}</Text>
              <Text className="mt-1 text-[10px] uppercase tracking-wide text-textSecondary">
                {m.year_from}{m.year_to ? `–${m.year_to}` : ''} · {m.modifications_count} модиф.
              </Text>
            </Pressable>
          ))}
        </View>

        {filtered.length === 0 ? <ErrorPlate text="Модели не найдены." muted /> : null}
        {canExpand ? (
          <Pressable onPress={() => setShowAll(true)} className="items-center rounded-sct border-2 border-dashed border-borderLight py-4">
            <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[12px] uppercase tracking-widest text-textSecondary">
              Показать все модели ({filtered.length})
            </Text>
          </Pressable>
        ) : null}
      </StepCard>
    </ScrollView>
  )
}

// --- Шаг 3: Поколение (год / кузов / поколение) ---
const YEAR_LIMIT = 12

function SpecsPicker({
  markId,
  modelId,
  values,
  onChange,
  onContinue,
}: {
  markId: number
  modelId: number
  values: SpecsValues
  onChange: (next: SpecsValues) => void
  onContinue: () => void
}) {
  const query = useMemo(() => ({ mark: markId, model: modelId, ...values }), [markId, modelId, values])
  const { data, isFetching, isError } = useFiltersQuery(query)
  const [showAllYears, setShowAllYears] = useState(false)

  const years = data?.years ?? []
  const bodyTypes = data?.body_types ?? []
  const generations = data?.generations ?? []
  const count = data?.modifications_count ?? 0

  const sortedYears = useMemo(() => [...years].sort((a, b) => b - a), [years])
  const visibleYears = showAllYears ? sortedYears : sortedYears.slice(0, YEAR_LIMIT)

  const selectYear = (y: number) =>
    onChange({ year: values.year === y ? undefined : y, body_type: undefined, generation: undefined })
  const selectBody = (id: number) =>
    onChange({ ...values, body_type: values.body_type === id ? undefined : id, generation: undefined })
  const selectGeneration = (id: number) => {
    onChange({ ...values, generation: id })
    onContinue()
  }

  if (isFetching && !data) return <Centered><Spinner /></Centered>

  return (
    <View className="flex-1">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <StepCard>
          {isError ? (
            <View className="rounded-sct border border-amber-200 bg-amber-50 p-3">
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-sm text-amber-800">
                Сервер не смог посчитать параметры под эту модель.
              </Text>
              <Text className="mt-1 text-xs text-amber-800/80">
                Можно пропустить и сразу перейти к выбору модификации.
              </Text>
            </View>
          ) : null}

          <View className="gap-3">
            <SectionLabel>Год выпуска</SectionLabel>
            {years.length === 0 ? (
              <Text className="text-sm text-textSecondary/70">Нет доступных годов — переходите к модификациям.</Text>
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2">
                  {visibleYears.map((y) => (
                    <SelectTile key={y} active={values.year === y} onPress={() => selectYear(y)} className="min-w-[22%] items-center">
                      <Text
                        style={{ fontFamily: 'Inter_900Black' }}
                        className={cn('text-sm', values.year === y ? 'text-brandBlue' : 'text-textPrimary')}
                      >
                        {y}
                      </Text>
                    </SelectTile>
                  ))}
                </View>
                {!showAllYears && sortedYears.length > YEAR_LIMIT ? (
                  <Pressable onPress={() => setShowAllYears(true)} className="items-center rounded-sct border-2 border-dashed border-borderLight py-3">
                    <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[12px] uppercase tracking-widest text-textSecondary">
                      Показать все года ({sortedYears.length})
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>

          {values.year !== undefined && bodyTypes.length > 0 ? (
            <View className="gap-3 border-t border-borderLight pt-5">
              <SectionLabel>Тип кузова</SectionLabel>
              <View className="flex-row flex-wrap gap-2">
                {bodyTypes.map((b) => (
                  <SelectTile key={b.id} active={values.body_type === b.id} onPress={() => selectBody(b.id)}>
                    <Text
                      style={{ fontFamily: 'Inter_900Black' }}
                      className={cn('text-[12px] uppercase', values.body_type === b.id ? 'text-brandBlue' : 'text-textPrimary')}
                    >
                      {b.name || b.code}
                    </Text>
                  </SelectTile>
                ))}
              </View>
            </View>
          ) : null}

          {values.year !== undefined && generations.length > 0 ? (
            <View className="gap-3 border-t border-borderLight pt-5">
              <SectionLabel>Поколение</SectionLabel>
              {generations.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => selectGeneration(g.id)}
                  className={cn('rounded-sct border bg-white p-4', values.generation === g.id ? 'border-brandBlue bg-blue-50' : 'border-borderLight')}
                >
                  <Text style={{ fontFamily: 'Inter_900Black' }} className="text-sm uppercase text-textPrimary">{g.display_name}</Text>
                  <Text className="mt-0.5 text-[11px] uppercase tracking-widest text-textSecondary">
                    {g.year_from}{g.year_to ? `–${g.year_to}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </StepCard>
      </ScrollView>

      <BottomBar>
        <Button fullWidth onPress={onContinue}>
          {count > 0 ? `Показать модификации (${count})` : 'К выбору модификации'}
        </Button>
      </BottomBar>
    </View>
  )
}

// --- Шаг 4: Характеристики (chip-фильтры + сетка модификаций) ---
function ModificationPicker({
  markId,
  modelId,
  specs,
  onChangeSpecs,
  selectedId,
  onSelect,
  onConfirm,
}: {
  markId: number
  modelId: number
  specs: SpecsValues
  onChangeSpecs: (next: SpecsValues) => void
  selectedId: number | null
  onSelect: (m: Modification) => void
  onConfirm: () => void
}) {
  const baseQuery: CarsQuery = useMemo(() => ({ mark: markId, model: modelId, ...specs }), [markId, modelId, specs])
  const { data: filters } = useFiltersQuery(baseQuery)
  const { data, isLoading, isError } = useModificationsQuery({ ...baseQuery, page_size: 100 })
  const mods = data?.results ?? []
  const total = data?.count ?? mods.length

  const setFilter = (patch: Partial<SpecsValues>) => onChangeSpecs({ ...specs, ...patch })

  const fuelOpts = (filters?.fuel_types ?? []).map((f) => ({ value: f.value, label: f.label || f.value }))
  const volumeOpts = (filters?.engine_volumes ?? []).map((o) => ({
    value: String(o.value),
    label: formatEngineVolume(o.value) ?? String(o.value),
  }))
  const powerOpts = (filters?.horse_powers ?? []).map((o) => ({ value: String(o.value), label: String(o.value) }))
  const transOpts = mapCodeName(filters?.transmission_types)
  const driveOpts = mapCodeName(filters?.drive_types)
  const steerOpts = mapCodeName(filters?.steering_positions)

  return (
    <View className="flex-1">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <StepCard>
          <FilterChips label="Тип топлива" options={fuelOpts} value={specs.fuel_type} onToggle={(v) => setFilter({ fuel_type: v })} />
          <FilterChips
            label="Объём двигателя"
            options={volumeOpts}
            value={specs.engine_volume !== undefined ? String(specs.engine_volume) : undefined}
            onToggle={(v) => setFilter({ engine_volume: v ? Number(v) : undefined })}
          />
          <FilterChips
            label="Мощность (л.с.)"
            options={powerOpts}
            value={specs.horse_power !== undefined ? String(specs.horse_power) : undefined}
            onToggle={(v) => setFilter({ horse_power: v ? Number(v) : undefined })}
          />
          <FilterChips label="Коробка передач" options={transOpts} value={specs.transmission_type} onToggle={(v) => setFilter({ transmission_type: v })} />
          <FilterChips label="Тип привода" options={driveOpts} value={specs.drive_type} onToggle={(v) => setFilter({ drive_type: v })} />
          <FilterChips label="Тип руля" options={steerOpts} value={specs.steering_wheel_position} onToggle={(v) => setFilter({ steering_wheel_position: v })} />

          <View className="gap-3 border-t border-borderLight pt-5">
            <SectionLabel>Подходящие авто ({total.toLocaleString('ru-RU')})</SectionLabel>

            {isLoading ? (
              <View className="items-center justify-center py-10"><Spinner /></View>
            ) : isError ? (
              <ErrorPlate text="Не удалось загрузить характеристики." />
            ) : mods.length === 0 ? (
              <ErrorPlate text="Под выбранные параметры авто не найдены. Уберите часть фильтров." muted />
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {mods.map((mod) => (
                  <ModCard key={mod.id} mod={mod} active={mod.id === selectedId} onPress={() => onSelect(mod)} />
                ))}
              </View>
            )}
          </View>
        </StepCard>
      </ScrollView>

      <BottomBar>
        <Button fullWidth disabled={selectedId == null} onPress={onConfirm}>
          Далее
        </Button>
      </BottomBar>
    </View>
  )
}

function ModCard({ mod, active, onPress }: { mod: Modification; active: boolean; onPress: () => void }) {
  const title = mod.full_title || mod.name || mod.display_name || mod.title || `Модификация #${mod.id}`
  const yearRange = mod.year_from || mod.year_to ? `${mod.year_from ?? ''}${mod.year_to ? `–${mod.year_to}` : ''}` : null
  const sub = [yearRange, mod.drive_type_label].filter(Boolean).join(' · ')

  return (
    <Pressable
      onPress={onPress}
      className={cn('w-[48%] overflow-hidden rounded-sct border bg-white', active ? 'border-brandBlue' : 'border-borderLight')}
    >
      <View className="aspect-[16/10] bg-surfaceLight">
        <SafeImage
          uri={mod.photo_url ?? undefined}
          resizeMode="cover"
          className="h-full w-full"
          fallback={
            <View className="h-full w-full items-center justify-center">
              <Text style={{ fontFamily: 'Inter_900Black' }} className="text-2xl uppercase text-borderLight">
                {title.slice(0, 2)}
              </Text>
            </View>
          }
        />
      </View>
      <View className="p-3">
        {mod.configuration_name ? (
          <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="text-[10px] uppercase tracking-widest text-brandBlue">
            {mod.configuration_name}
          </Text>
        ) : null}
        <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="text-sm uppercase text-textPrimary">{title}</Text>
        {sub ? <Text numberOfLines={1} className="mt-0.5 text-[10px] uppercase tracking-widest text-textSecondary">{sub}</Text> : null}
      </View>
    </Pressable>
  )
}

// --- Шаг 5: Комплектация ---
function TrimPicker({
  modificationId,
  selectedTrimSourceId,
  onSelect,
}: {
  modificationId: number
  selectedTrimSourceId: string | null
  onSelect: (t: Trim) => void
}) {
  const { data: trims, isLoading, isError } = useTrimsQuery(modificationId)

  // Одна комплектация → выбираем автоматически и пропускаем шаг.
  useEffect(() => {
    if (trims && trims.length === 1 && !selectedTrimSourceId) {
      onSelect(trims[0])
    }
  }, [trims, selectedTrimSourceId, onSelect])

  if (isLoading) return <Centered><Spinner /></Centered>
  if (isError) return <ErrorPlate text="Не удалось загрузить комплектации." />

  const items = trims ?? []
  if (items.length === 0) return <ErrorPlate text="Для этой модификации нет комплектаций." muted />
  // Одна — выберет эффект; показываем спиннер, чтобы не мигал список из одной.
  if (items.length === 1) return <Centered><Spinner /></Centered>

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <StepCard>
        <SectionLabel>Комплектация</SectionLabel>
        {items.map((t) => {
          const active = t.source_id === selectedTrimSourceId
          return (
            <Pressable
              key={t.id}
              onPress={() => onSelect(t)}
              className={cn(
                'flex-row items-center justify-between gap-3 rounded-sct border bg-white p-4',
                active ? 'border-brandBlue bg-blue-50' : 'border-borderLight',
              )}
            >
              <Text style={{ fontFamily: 'Inter_900Black' }} numberOfLines={1} className="flex-1 text-sm uppercase text-textPrimary">
                {t.display_name || t.name || 'Комплектация'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={active ? '#1F5FAF' : '#D9DEE5'} />
            </Pressable>
          )
        })}

        {/* Человек может не знать комплектацию — даём пропустить. Бэк требует
            валидный modification_trim_source_id, поэтому берём первую доступную
            (не снятую с производства) — уточнить можно позже. */}
        <Pressable
          onPress={() => onSelect(items.find((t) => !t.is_closed) ?? items[0])}
          className="mt-3 items-center rounded-sct border border-dashed border-borderLight p-4 active:opacity-80"
        >
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-[12px] uppercase tracking-widest text-textSecondary">
            Пропустить
          </Text>
        </Pressable>
      </StepCard>
    </ScrollView>
  )
}

// --- Шаг 6: Номер ---
// Госномер проверяем по казахстанскому формату (3 цифры + 2–3 буквы + регион
// 01–20), см. shared/lib/license-plate. Раньше стоял почти пустой паттерн, и
// в гараж проходили огрызки без региона. Поле «псевдоним» убрано по просьбе
// заказчика — его можно задать позже в редактировании авто.
const vinRegex = /^[A-HJ-NPR-Z0-9]{0,17}$/

const finalSchema = z.object({
  license_plate: z
    .string()
    .min(1, 'Введите госномер')
    .refine(isValidLicensePlate, LICENSE_PLATE_ERROR),
  vin_code: z
    .string()
    .regex(vinRegex, 'VIN — только латиница (без I, O, Q) и цифры')
    .max(17, 'VIN не больше 17 символов')
    .optional()
    .or(z.literal('')),
})
type FinalValues = z.infer<typeof finalSchema>

function FinalForm({
  defaultVin,
  onSubmit,
  serverError,
}: {
  defaultVin?: string
  onSubmit: (v: FinalValues) => Promise<void>
  serverError: string | null
}) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FinalValues>({
    resolver: zodResolver(finalSchema),
    defaultValues: { license_plate: '', vin_code: defaultVin ?? '' },
  })

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <StepCard>
        <Text style={{ fontFamily: 'Inter_900Black' }} className="text-center text-2xl uppercase text-textPrimary">
          Почти готово
        </Text>
        <Text className="text-center text-sm text-textSecondary">Введите данные для регистрации в системе</Text>

        <Controller
          control={control}
          name="license_plate"
          render={({ field }) => (
            <Input
              label="Госномер (обязательно)"
              placeholder="123ABC02"
              autoCapitalize="characters"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.license_plate?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="vin_code"
          render={({ field }) => (
            <Input
              label="Введите VIN код (необязательно)"
              placeholder="VIN код"
              autoCapitalize="characters"
              maxLength={17}
              value={field.value}
              onChangeText={(t) => field.onChange(t.toUpperCase())}
              onBlur={field.onBlur}
              error={errors.vin_code?.message}
            />
          )}
        />

        {serverError ? (
          <View className="rounded-sct border border-red-200 bg-red-50 p-3">
            <Text className="text-red-700">{serverError}</Text>
          </View>
        ) : null}

        <Button fullWidth size="lg" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
          Добавить в гараж
        </Button>
      </StepCard>
    </ScrollView>
  )
}

// --- helpers ---
function StepCard({ children }: { children: ReactNode }) {
  return <View className="gap-4 rounded-sct-lg border border-borderLight bg-white p-4">{children}</View>
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontFamily: 'Inter_900Black' }} className="text-[12px] uppercase tracking-widest text-textSecondary">
      {children}
    </Text>
  )
}

function SelectTile({
  active,
  onPress,
  className,
  children,
}: {
  active: boolean
  onPress: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-sct border px-4 py-2.5',
        active ? 'border-brandBlue bg-blue-50' : 'border-borderLight bg-white',
        className,
      )}
    >
      {children}
    </Pressable>
  )
}

function FilterChips({
  label,
  options,
  value,
  onToggle,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string | undefined
  onToggle: (value: string | undefined) => void
}) {
  if (options.length === 0) return null
  return (
    <View className="gap-3">
      <SectionLabel>{label}</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.value
          return (
            <SelectTile key={o.value} active={active} onPress={() => onToggle(active ? undefined : o.value)}>
              <Text
                style={{ fontFamily: 'Inter_700Bold' }}
                className={cn('text-[13px]', active ? 'text-brandBlue' : 'text-textPrimary')}
              >
                {o.label}
              </Text>
            </SelectTile>
          )
        })}
      </View>
    </View>
  )
}

function mapCodeName(items: CodeNameOption[] | undefined): { value: string; label: string }[] {
  if (!items) return []
  return items.map((it) => ({ value: it.value, label: it.label ?? it.name ?? it.code ?? it.value }))
}

function Centered({ children }: { children: ReactNode }) {
  return <View className="flex-1 items-center justify-center bg-surfaceLight">{children}</View>
}

function ErrorPlate({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <View className={cn('rounded-sct border p-4', muted ? 'border-borderLight bg-surfaceLight' : 'border-red-200 bg-red-50')}>
      <Text style={{ fontFamily: 'Inter_700Bold' }} className={cn('text-center text-sm', muted ? 'text-textSecondary' : 'text-red-700')}>
        {text}
      </Text>
    </View>
  )
}

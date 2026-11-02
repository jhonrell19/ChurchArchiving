'use client'

import { useCallback, useEffect, useState } from 'react'
import { getCountries } from 'libphonenumber-js/max'

export type AddressInfo = {
  country: string; region: string; province: string; city: string
  barangay: string; postalCode: string; street: string
}
export const emptyAddress: AddressInfo = { country:'PH', region:'', province:'', city:'', barangay:'', postalCode:'', street:'' }
const names = new Intl.DisplayNames(['en'], {type:'region'})
const countries = getCountries().map(code=>({code,name:names.of(code)||code})).sort((a,b)=>a.name.localeCompare(b.name))
export function formatAddress(info: AddressInfo) {
  return [info.street,info.barangay,info.city,info.province,info.region,info.postalCode,names.of(info.country)||info.country]
    .map(x=>x.trim()).filter(Boolean).join(', ')
}
type Option = {code:string;name:string}
const fieldClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-navy-mid outline-none focus:border-gold focus:ring-2 focus:ring-gold/10'

export default function StructuredAddressField({value,onChange}:{value:AddressInfo;onChange:(next:AddressInfo)=>void}) {
  const [regions,setRegions]=useState<Option[]>([])
  const [provinces,setProvinces]=useState<Option[]>([])
  const [cities,setCities]=useState<Option[]>([])
  const [barangays,setBarangays]=useState<Option[]>([])
  const [regionCode,setRegionCode]=useState('')
  const [provinceCode,setProvinceCode]=useState('')
  const [cityCode,setCityCode]=useState('')
  const [barangayCode,setBarangayCode]=useState('')
  const [offline,setOffline]=useState(false)
  const isPH=value.country==='PH'
  const change=(updates:Partial<AddressInfo>)=>onChange({...value,...updates})
  const get=useCallback(async (level:string,query:Record<string,string>,setter:(v:Option[])=>void) => {
    try {
      const response=await fetch(`/api/location/ph?${new URLSearchParams({level,...query})}`,{cache:'default'})
      if(!response.ok) throw new Error('Location directory unavailable')
      const data=await response.json()
      if(!Array.isArray(data.options)) throw new Error('Unexpected location data')
      setter(data.options);setOffline(false)
    } catch {setter([]);setOffline(true)}
  }, [])
  useEffect(()=>{if(isPH) void get('regions',{},setRegions)},[isPH,get])
  useEffect(()=>{setProvinces([]);if(isPH&&regionCode) void get('provinces',{region:regionCode},setProvinces)},[isPH,regionCode,get])
  useEffect(()=>{setCities([]);if(isPH&&regionCode) void get('cities',provinceCode?{province:provinceCode}:{region:regionCode},setCities)},[isPH,regionCode,provinceCode,get])
  useEffect(()=>{setBarangays([]);if(isPH&&cityCode) void get('barangays',{city:cityCode},setBarangays)},[isPH,cityCode,get])
  const named=(opts:Option[],code:string)=>opts.find(item=>item.code===code)?.name||''
  const choose=(name:string, opts:Option[],code:string,action:(code:string)=>void,disabled=false)=> <label className="block text-sm font-medium text-navy-mid">{name}
    <select className={fieldClass} value={code} onChange={e=>action(e.target.value)} disabled={disabled} required={!disabled}>
      <option value="">Select {name.toLowerCase()}</option>
      {opts.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}
    </select></label>
  const input=(name:string,key:keyof AddressInfo,required=false,placeholder='')=><label className="block text-sm font-medium text-navy-mid">{name}
    <input className={fieldClass} value={value[key]} onChange={e=>change({[key]:e.target.value})} maxLength={130} required={required} placeholder={placeholder}/>
  </label>
  return <div className="md:col-span-2 space-y-3">
    <h3 className="font-semibold text-navy-mid">Residential / mailing address *</h3>
    <label className="block text-sm font-medium text-navy-mid">Country
      <select className={fieldClass} value={value.country} onChange={e=>{
        setRegionCode('');setProvinceCode('');setCityCode('');setBarangayCode('');setOffline(false)
        onChange({...emptyAddress,country:e.target.value})
      }} required>{countries.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select>
    </label>
    {isPH&&!offline ? <div className="grid gap-3 md:grid-cols-2">
      {choose('Region',regions,regionCode,code=>{
        setRegionCode(code);setProvinceCode('');setCityCode('');setBarangayCode('');
        change({region:named(regions,code),province:'',city:'',barangay:''})
      },!regions.length)}
      {choose('Province (if applicable)',provinces,provinceCode,code=>{
        setProvinceCode(code);setCityCode('');setBarangayCode('');
        change({province:named(provinces,code),city:'',barangay:''})
      },!regionCode||!provinces.length)}
      {choose('City / Municipality',cities,cityCode,code=>{
        setCityCode(code);setBarangayCode('');change({city:named(cities,code),barangay:''})
      },!regionCode||!cities.length)}
      {choose('Barangay',barangays,barangayCode,code=>{
        setBarangayCode(code);change({barangay:named(barangays,code)})
      },!cityCode||!barangays.length)}
    </div> : <div className="grid gap-3 md:grid-cols-2">
      {input('State / Region','region',true,'State / Region')}
      {input('Province / District','province',false,'Province / District')}
      {input('City / Municipality','city',true,'City or municipality')}
      {isPH&&input('Barangay','barangay',false,'Barangay')}
    </div>}
    {offline&&isPH&&<p role="status" className="text-xs text-amber-800">Location service is unavailable. Enter your location in the manual fields.</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {input('ZIP / Postal code','postalCode',true,'ZIP or postal code')}
      <div className="md:col-span-2">{input('House no., block, street, phase, subdivision or unit','street',true,'House no., street, subdivision...')}</div>
    </div>
  </div>
}

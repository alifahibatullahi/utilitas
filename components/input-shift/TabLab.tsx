'use client';
import React from 'react';
import { Card, InputField, CalculatedField } from './SharedComponents';

interface TabLabProps {
    waterQualityValues?: Record<string, number | string | null>;
    chemicalDosingValues?: Record<string, number | string | null>;
    onWaterQualityChange?: (name: string, value: number | string | null) => void;
    onChemicalDosingChange?: (name: string, value: number | string | null) => void;
}

export default function TabLab({
    waterQualityValues = {},
    chemicalDosingValues = {},
    onWaterQualityChange,
    onChemicalDosingChange,
}: TabLabProps) {
    const wq = waterQualityValues;
    const cd = chemicalDosingValues;

    return (
        <>
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Chemical Dosing Section */}
                    <div className="rounded-xl ring-1 ring-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]">
                        <Card title="Phosphate" icon="science" color="purple">
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Level Tanki" unit="cm" color="purple" name="phosphate_level_tanki" value={cd.phosphate_level_tanki} onChange={onChemicalDosingChange} />
                                <InputField label="Stroke Pompa" unit="%" color="purple" name="phosphate_stroke_pompa" value={cd.phosphate_stroke_pompa} onChange={onChemicalDosingChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Penambahan Air" unit="liter" color="purple" name="phosphate_penambahan_air" value={cd.phosphate_penambahan_air} onChange={onChemicalDosingChange} />
                                <InputField label="Penambahan Chemical" unit="liter" color="purple" name="phosphate_penambahan_chemical" value={cd.phosphate_penambahan_chemical} onChange={onChemicalDosingChange} />
                            </div>
                        </Card>
                    </div>

                    <div className="rounded-xl ring-1 ring-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]">
                        <Card title="Amine" icon="science" color="indigo">
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Level Tanki" unit="cm" color="indigo" name="amine_level_tanki" value={cd.amine_level_tanki} onChange={onChemicalDosingChange} />
                                <InputField label="Stroke Pompa" unit="%" color="indigo" name="amine_stroke_pompa" value={cd.amine_stroke_pompa} onChange={onChemicalDosingChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Penambahan Air" unit="liter" color="indigo" name="amine_penambahan_air" value={cd.amine_penambahan_air} onChange={onChemicalDosingChange} />
                                <InputField label="Penambahan Chemical" unit="liter" color="indigo" name="amine_penambahan_chemical" value={cd.amine_penambahan_chemical} onChange={onChemicalDosingChange} />
                            </div>
                        </Card>
                    </div>

                    <div className="rounded-xl ring-1 ring-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.15)]">
                        <Card title="Hydrazine" icon="science" color="orange">
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Level Tanki" unit="cm" color="orange" name="hydrazine_level_tanki" value={cd.hydrazine_level_tanki} onChange={onChemicalDosingChange} />
                                <InputField label="Stroke Pompa" unit="%" color="orange" name="hydrazine_stroke_pompa" value={cd.hydrazine_stroke_pompa} onChange={onChemicalDosingChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <InputField label="Penambahan Air" unit="liter" color="orange" name="hydrazine_penambahan_air" value={cd.hydrazine_penambahan_air} onChange={onChemicalDosingChange} />
                                <InputField label="Penambahan Chemical" unit="liter" color="orange" name="hydrazine_penambahan_chemical" value={cd.hydrazine_penambahan_chemical} onChange={onChemicalDosingChange} />
                            </div>
                        </Card>
                    </div>

                    {/* Water Quality Section Divider */}
                    <div className="col-span-1 md:col-span-2 flex items-center gap-3 pt-2">
                        <div className="h-px bg-slate-700/50 flex-1"></div>
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Water Quality</span>
                        <div className="h-px bg-slate-700/50 flex-1"></div>
                    </div>

                    <Card title="Demin TK 1250" icon="water_drop" color="cyan">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="pH" unit="" color="cyan" name="demin_1250_ph" value={wq.demin_1250_ph} onChange={onWaterQualityChange} />
                            <InputField label="Conductivity" unit="μS/cm" color="cyan" name="demin_1250_conduct" value={wq.demin_1250_conduct} onChange={onWaterQualityChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="TH" unit="ppm" color="cyan" name="demin_1250_th" value={wq.demin_1250_th} onChange={onWaterQualityChange} />
                            <InputField label="SiO₂" unit="ppb" color="cyan" name="demin_1250_sio2" value={wq.demin_1250_sio2} onChange={onWaterQualityChange} />
                        </div>
                    </Card>

                    <Card title="Boiler Feed Water" icon="water_drop" color="emerald">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="pH" unit="" color="emerald" name="bfw_ph" value={wq.bfw_ph} onChange={onWaterQualityChange} />
                            <InputField label="Conductivity" unit="μS/cm" color="emerald" name="bfw_conduct" value={wq.bfw_conduct} onChange={onWaterQualityChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="TH" unit="ppm" color="emerald" name="bfw_th" value={wq.bfw_th} onChange={onWaterQualityChange} />
                            <InputField label="SiO₂" unit="ppb" color="emerald" name="bfw_sio2" value={wq.bfw_sio2} onChange={onWaterQualityChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="NH₄" unit="ppm" color="emerald" name="bfw_nh4" value={wq.bfw_nh4} onChange={onWaterQualityChange} />
                            <InputField label="CHZ" unit="ppb" color="emerald" name="bfw_chz" value={wq.bfw_chz} onChange={onWaterQualityChange} />
                        </div>
                    </Card>

                    <Card title="Boiler Water A" icon="science" color="blue">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="pH" unit="" color="blue" name="boiler_water_a_ph" value={wq.boiler_water_a_ph} onChange={onWaterQualityChange} />
                            <InputField label="Conductivity" unit="μS/cm" color="blue" name="boiler_water_a_conduct" value={wq.boiler_water_a_conduct} onChange={onWaterQualityChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="SiO₂" unit="ppb" color="blue" name="boiler_water_a_sio2" value={wq.boiler_water_a_sio2} onChange={onWaterQualityChange} />
                            <InputField label="PO₄" unit="ppm" color="blue" name="boiler_water_a_po4" value={wq.boiler_water_a_po4} onChange={onWaterQualityChange} />
                        </div>
                    </Card>

                    <Card title="Boiler Water B" icon="science" color="cyan">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="pH" unit="" color="cyan" name="boiler_water_b_ph" value={wq.boiler_water_b_ph} onChange={onWaterQualityChange} />
                            <InputField label="Conductivity" unit="μS/cm" color="cyan" name="boiler_water_b_conduct" value={wq.boiler_water_b_conduct} onChange={onWaterQualityChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="SiO₂" unit="ppb" color="cyan" name="boiler_water_b_sio2" value={wq.boiler_water_b_sio2} onChange={onWaterQualityChange} />
                            <InputField label="PO₄" unit="ppm" color="cyan" name="boiler_water_b_po4" value={wq.boiler_water_b_po4} onChange={onWaterQualityChange} />
                        </div>
                    </Card>

                    <Card title="Product Steam" icon="air" color="orange">
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="pH" unit="" color="orange" name="product_steam_ph" value={wq.product_steam_ph} onChange={onWaterQualityChange} />
                            <InputField label="Conductivity" unit="μS/cm" color="orange" name="product_steam_conduct" value={wq.product_steam_conduct} onChange={onWaterQualityChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="TH" unit="ppm" color="orange" name="product_steam_th" value={wq.product_steam_th} onChange={onWaterQualityChange} />
                            <InputField label="SiO₂" unit="ppb" color="orange" name="product_steam_sio2" value={wq.product_steam_sio2} onChange={onWaterQualityChange} />
                        </div>
                        <InputField label="NH₄" unit="ppm" color="orange" name="product_steam_nh4" value={wq.product_steam_nh4} onChange={onWaterQualityChange} />
                    </Card>

                </div>
            </div>

            <div className="w-full xl:w-[350px] shrink-0 h-full flex flex-col">
                <Card title="Lab Summary" icon="summarize" color="purple" isSidebar={true}>
                    <CalculatedField label="PHOSPHATE" value={(Number(cd.phosphate_penambahan_chemical) || 0).toFixed(1)} unit="liter" variant="primary" />
                    <CalculatedField label="AMINE" value={(Number(cd.amine_penambahan_chemical) || 0).toFixed(1)} unit="liter" variant="transparent" />
                    <CalculatedField label="HYDRAZINE" value={(Number(cd.hydrazine_penambahan_chemical) || 0).toFixed(1)} unit="liter" variant="transparent" />

                    <div className="h-px bg-slate-700/80 w-full my-1"></div>

                    <CalculatedField label="BFW pH" value={(Number(wq.bfw_ph) || 0).toFixed(2)} unit="" variant="primary" />
                    <CalculatedField label="BOILER WATER A pH" value={(Number(wq.boiler_water_a_ph) || 0).toFixed(2)} unit="" variant="transparent" />
                    <CalculatedField label="BOILER WATER B pH" value={(Number(wq.boiler_water_b_ph) || 0).toFixed(2)} unit="" variant="transparent" />
                    <CalculatedField label="PRODUCT STEAM pH" value={(Number(wq.product_steam_ph) || 0).toFixed(2)} unit="" variant="transparent" />
                </Card>
            </div>
        </>
    );
}

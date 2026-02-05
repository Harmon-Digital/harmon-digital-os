import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatKpiValue } from "@/config/kpiConfig";

export default function KpiScorecard({ kpiDef, actual, target, previousActual, bonusAmount }) {
  const Icon = kpiDef.icon;
  const pct = target ? Math.round((actual / target) * 100) : null;
  const cappedPct = pct !== null ? Math.min(pct, 100) : 0;

  // MoM delta
  let delta = null;
  let deltaAbs = null;
  if (previousActual !== null && previousActual !== undefined && previousActual !== 0) {
    delta = ((actual - previousActual) / previousActual) * 100;
    deltaAbs = actual - previousActual;
  } else if (previousActual === 0 && actual > 0) {
    delta = 100;
    deltaAbs = actual;
  }

  const progressColor =
    pct === null ? "bg-gray-300" :
    pct >= 80 ? "bg-green-500" :
    pct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded bg-${kpiDef.color}-100`}>
            <Icon className={`w-4 h-4 text-${kpiDef.color}-600`} />
          </div>
          <span className="text-xs font-medium text-gray-500 truncate">{kpiDef.name}</span>
        </div>

        <div className="mb-1">
          <span className="text-2xl font-bold text-gray-900">
            {formatKpiValue(actual, kpiDef.unit)}
          </span>
          {target !== null && target !== undefined && (
            <span className="text-lg text-gray-400 font-normal"> / {formatKpiValue(target, kpiDef.unit)}</span>
          )}
        </div>

        {target !== null && target !== undefined && (
          <>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all ${progressColor}`}
                style={{ width: `${cappedPct}%` }}
              />
            </div>
            <div className="text-xs text-right">
              <span className={pct >= 100 ? "text-green-600 font-medium" : "text-gray-500"}>{pct}%</span>
            </div>
          </>
        )}

        {bonusAmount > 0 && (
          <div className={`text-xs px-2 py-0.5 rounded-full text-center mt-1 ${
            pct >= 100 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
          }`}>
            {pct >= 100 ? "\u2713" : "Goal:"} ${bonusAmount} bonus
          </div>
        )}

        {delta !== null && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
            {delta >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            <span>{delta >= 0 ? "+" : ""}{delta.toFixed(0)}% vs last week</span>
          </div>
        )}
        {delta === null && (
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
            <Minus className="w-3 h-3" />
            <span>No prior data</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

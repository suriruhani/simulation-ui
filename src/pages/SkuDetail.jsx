import { Box, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import DeepDiveChart from '../components/DeepDiveChart'
import VendorPerformance from '../components/VendorPerformance'
import AskDobby from '../components/AskDobby'

const SkuDetail = ({ sku }) => {
  const [rootCause, setRootCause] = useState('Loading...')
  const [context, setContext] = useState(null)
  const [vendorData, setVendorData] = useState(null)
  const [simulationDay, setSimulationDay] = useState(null)
  const [range, setRange] = useState([1, 1])
  const [trendData, setTrendData] = useState(null)
  const [suggestedAction, setSuggestedAction] = useState('Loading...')
  const [isAutoResolved, setIsAutoResolved] = useState(false)
  const API_BASE = process.env.REACT_APP_API_BASE;

  // Fetch latest simulation day and metric lookback period
  useEffect(() => {
    fetch(`${API_BASE}/simulation-range`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    })    
      .then(res => res.json())
      .then(data => {
        setSimulationDay(data.maxDay)
        setRange([data.lookbackMin || data.minDay, data.maxDay])
      })
      .catch(() => {
        setSimulationDay(30)
        setRange([1, 30])
      })
  }, [])

  // Fetch root cause analysis
  useEffect(() => {
    if (!sku || !simulationDay) return

    setRootCause('Loading...')
    setSuggestedAction('Loading...')
    setContext(null)

    fetch(`${API_BASE}/sku-root-cause`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      },
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, day: simulationDay })
    })
      .then((res) => res.json())
      .then((data) => {
        setRootCause(data.root_cause || 'No analysis available.')
        setSuggestedAction(data.suggested_action || 'No action available.')
        setIsAutoResolved(data.auto_action || false)
        setContext(data)
      })
      .catch(() => {
        setRootCause('Failed to load root cause.')
        setSuggestedAction('Failed to load suggested action.')
        setIsAutoResolved(false)
      })
  }, [sku, simulationDay])

  // Fetch vendor performance metrics
  useEffect(() => {
    if (!sku || !simulationDay) return

    setVendorData(null)

    fetch(`${API_BASE}/vendor-performance/${sku}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    })
      .then((res) => res.json())
      .then((data) => setVendorData(data))
      .catch(() => setVendorData(null))
  }, [sku, simulationDay])

  // Fetch inventory and demand trend
  useEffect(() => {
    if (!sku) return

    fetch(`${API_BASE}/get_inventory_trend/${sku}`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    })
      .then((res) => res.json())
      .then((data) => setTrendData(data))
      .catch(() => setTrendData(null))
  }, [sku])

  return (
    <>
      <Box width="100%" height="100vh" display="flex" flexDirection="column">
        {/* Top 30% */}
        <Box flex="0 0 30%" display="flex" borderBottom="1px solid #ccc">
          {/* Call-out Block */}
          <Box flex="1" p={2} borderRight="1px solid #ccc" bgcolor="background.paper">
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              📣 Call-out
            </Typography>
            <Typography variant="body2" whiteSpace="pre-line">
              {rootCause}
            </Typography>
          </Box>

          {/* Suggested Action Block */}
          <Box flex="1" p={2} bgcolor="background.paper">
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {isAutoResolved ? "🤖 Action taken by Dobby" : "✅ Suggested Action"}
            </Typography>
            <Typography variant="body2">
              {suggestedAction}
            </Typography>
          </Box>
        </Box>

        {/* Bottom 70%: Inventory Chart + Vendor Performance */}
        <Box flex="1" p={2} display="flex" gap={2}>
          <Box flex={1}>
            <Typography variant="h6" fontWeight="bold" mb={1}>
              📊 Inventory Trend for {sku}
            </Typography>

            {/* Cumulative instock rate and lost sales display */}
            {trendData && trendData.days && trendData.days.length > 0 && (
              (() => {
                const filteredIndices = trendData.days.map((d, i) => i).filter(i => {
                  const day = trendData.days[i];
                  return day >= range[0] && day <= range[1];
                });

                const fulfilledInRange = filteredIndices.map(i => trendData.fulfilled[i]).reduce((a, b) => a + b, 0);
                const unfulfilledInRange = filteredIndices.map(i => trendData.unfulfilled[i]).reduce((a, b) => a + b, 0);
                const instockRate = (fulfilledInRange / (fulfilledInRange + unfulfilledInRange || 1)) * 100;
                const lostSales = (trendData.price || 0) * unfulfilledInRange;

                return (
                  <Typography variant="body2" fontWeight="bold" mb={1}>
                    Instock Rate: {instockRate.toFixed(1)}%, Lost Sales: ${ (lostSales / 1000).toFixed(1) }k
                  </Typography>
                );
              })()
            )}

            {trendData ? (
              <DeepDiveChart
                title={`SKU ${sku} Inventory & Demand`}
                data={trendData.days.map((day, idx) => ({
                  day,
                  inventory: trendData.inventory[idx],
                  fulfilled: trendData.fulfilled[idx],
                  unfulfilled: trendData.unfulfilled[idx],
                  mean_demand: trendData.mean_demand[idx],
                })).filter(d => d.day >= range[0] && d.day <= range[1])}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Loading inventory trend...
              </Typography>
            )}
          </Box>

          <Box flex={1}>
            {vendorData && vendorData.purchase_orders?.length > 0 ? (
              <VendorPerformance
                vendorId={vendorData.vendor_id}
                purchaseOrders={vendorData.purchase_orders}
                avgDelay={vendorData.average_delay}
                avgFillRate={vendorData.average_fill_rate}
              />
            ) : (
              <Typography>No vendor data available.</Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Ask Dobby chatbot (bottom-right floating) */}
      <AskDobby sku={sku} />
    </>
  )
}

export default SkuDetail

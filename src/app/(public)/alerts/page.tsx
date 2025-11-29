export const dynamic = 'force-dynamic'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Emergency Alerts</h1>
        <p className="text-muted-foreground">
          Current emergency alerts and notifications in your region.
        </p>
      </div>

      <Alert variant="info">
        <AlertTitle>No Active Alerts</AlertTitle>
        <AlertDescription>
          There are currently no active emergency alerts in your area. Stay prepared and check
          regularly for updates.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
            <CardDescription>Past alerts from the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No recent alerts to display.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alert Types</CardTitle>
            <CardDescription>Types of alerts we monitor</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                <span>Critical Emergencies</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-warning" />
                <span>Weather Warnings</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-info" />
                <span>Community Updates</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span>All Clear Notifications</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
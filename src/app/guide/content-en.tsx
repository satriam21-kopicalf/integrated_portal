'use client';

// The guide in English (same sections as content-id.tsx; menu names as the English portal shows them).

import { Calculator, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { Go, Menu, Note, Part, Steps, Table } from './ui';

export const PAGE = {
  title: 'Guide',
  subtitle: 'How to run stock opname and cost control in the portal',
  toc: 'Contents',
};

export const SO: Part = {
  key: 'so', label: 'Stock opname (PIC & crew)', icon: <ClipboardCheck size={16} />,
  intro: 'For the PIC and crew of outlets, HUB WH and HUB CK who count the stock. The branches shown are the ones assigned to your account.',
  sections: [
    {
      id: 'so-jadwal', title: 'When stock opname is done',
      body: (
        <>
          <p className="text-sm text-slate-700">The Cost Control team sets the schedules. The usual ones:</p>
          <Table head={['Count type', 'Schedule', 'What is counted']} rows={[
            ['Daily packaging count', 'Every day', 'Packaging & kitchen supplies: cups, lids, straws, bags, etc.'],
            ['Weekly raw material count', 'Every Monday', 'Raw materials, beans, WIP/premix'],
            ['Monthly raw material count', 'Last day of the month', 'All raw materials, WIP/premix'],
            ['Ad hoc count', 'When needed', 'Audit / handover, on request'],
          ]} />
          <p className="text-sm text-slate-700">The standard count window is <b>07:00–08:00 WIB</b> (before the outlet opens). <b>Every stock opname schedule uses WIB</b> for all outlets, hubs and kitchens, Bali included; the portal always shows WIB even when the phone clock differs. A count submitted after the window is accepted but marked <b>Late</b>. The exact names and times are on the <Go href="/stock-opname">Stock Opname</Go> page.</p>
        </>
      ),
    },
    {
      id: 'so-mulai', title: 'Starting a stock opname',
      body: (
        <Steps items={[
          <>Open <Menu>Stock Opname</Menu>. Under <b>Today</b> you see the counts due for each of your branches with the count window, number of items and areas.</>,
          <>Make sure you are at the location. Tap <Menu>Start count</Menu> and allow location (GPS) in the browser. The location is kept as evidence; outside the branch radius the count still runs but is flagged.</>,
          <>The count form opens. If the count was already started on another phone, the same form opens again (no duplicate count).</>,
        ]} />
      ),
    },
    {
      id: 'so-isi', title: 'Entering the quantities',
      body: (
        <>
          <Steps items={[
            <>Items are grouped by <b>area</b> (Bar, Chiller, Kitchen, Packaging, …). Pick an area at the top or search an item.</>,
            <>Every item takes <b>one number in the unit shown above its field</b>, as in the TEMPLATE SO PER CATEGORY: GR, PCS, PACK@100PCS, ROLL@1000PCS, etc. Example: straws in PACK@100PCS are 2.5 when there are two and a half packs; milk in GR is 1620.</>,
            <>An item that is not there <b>must be entered as 0</b>. An empty line keeps the count from being submitted.</>,
            <>Each line is saved automatically when you move to the next field (<b>Saved</b> at the top right). The <Menu>To do</Menu> button shows the items still empty.</>,
          ]} />
          <Note>Blind count: the system stock is deliberately not shown. Enter what is really there.</Note>
          <Note tone="warn">A quantity more than 3 times or less than a third of the previous count is marked <b>Check</b>. Check it again before submitting.</Note>
        </>
      ),
    },
    {
      id: 'so-wip', title: 'WIP / premix (weekly & monthly counts)',
      body: (
        <>
          <Steps items={[
            <>Open the <Menu>WIP / premix</Menu> section above the item list.</>,
            <><b>Weigh</b> every premix, cream or sauce that is there and enter its weight in <b>grams</b> (not pails or teko). Example: Premix Premium 2,350 g.</>,
            <>The <b>Filled into the items automatically</b> box shows the grams of every ingredient (fresh milk, espresso, creamer, …) from the premix recipe Cost Control set up. Example: Premix 950 g → the grams of each ingredient.</>,
            <>Tap <Menu>Save WIP</Menu>. The ingredient grams are filled into the same item lines (shown as “+ … from the WIP”) and those items count as entered, so they need no manual entry. Only the items the premix recipes use are filled; ingredients not on the list appear in the <b>WIP</b> area.</>,
          ]} />
          <Note>Do not count ingredients already mixed into a premix on their own lines; enter the premix grams in the WIP section only. Separate stock of an ingredient (e.g. unopened milk in the chiller) goes on its item line; the premix grams are added on top. The result goes to the SO report and the ESB export.</Note>
        </>
      ),
    },
    {
      id: 'so-foto', title: 'Evidence photos',
      body: (
        <>
          <Steps items={[
            <>The <Menu>Evidence photos</Menu> section is <b>at the end of the count form</b>, after all items. Photos are <b>optional</b>, at most <b>15 photos</b> per count (not per item or area).</>,
            <>Tap <Menu>Take photo</Menu>, point the camera, tap the round button, then <Menu>Use photo</Menu>. A wrong photo can be removed (× icon) until the count is submitted.</>,
            <>Once the count is submitted and <b>approved</b>, the evidence downloads in two formats: <Menu>Evidence PDF</Menu> (summary page + photos) and <Menu>Photos (ZIP)</Menu> (image files).</>,
          ]} />
          <Note tone="warn">Photos <b>must be taken with the camera</b> (phone or laptop); pictures from the gallery or files cannot be used. Allow the camera when the browser asks. Every photo is stamped with the <b>branch, count number, area/item, date & time (WIB) and location</b>.</Note>
        </>
      ),
    },
    {
      id: 'so-kirim', title: 'Submitting, recounts & done',
      body: (
        <>
          <Steps items={[
            <>When every line is filled and the WIP is saved, tap <Menu>Submit</Menu> and confirm. The location is recorded again.</>,
            <>After submitting, the count is <b>locked</b> and goes to Cost Control for review.</>,
            <>If the reviewer asks for a <b>recount</b>, the count opens again with the reviewer’s message. Only the lines marked <b>Recount</b> can be changed; the old values are kept for the audit. Submit again when done.</>,
          ]} />
          <Table head={['Status', 'Meaning']} rows={[
            ['In progress', 'Being filled in'], ['Submitted', 'Waiting for Cost Control review'], ['Recount requested', 'The reviewer asks to check some lines again'],
            ['Approved', 'Correct, ready for the ESB export'], ['Exported', 'In an ESB import file'],
          ]} />
        </>
      ),
    },
    {
      id: 'so-masalah', title: 'Common problems',
      body: (
        <Table head={['Problem', 'Solution']} rows={[
          ['Today’s count does not show', 'It is not due yet or the branch is not assigned to your account: contact Cost Control / the admin'],
          ['Submit is disabled', 'There are empty lines (enter 0) or unsaved WIP (see the text under the button)'],
          ['Location not found', 'Allow location in the browser; the count can still be submitted but is flagged'],
          ['Camera does not open', 'Allow the camera for this site in the browser settings (padlock in the address bar), then tap Try again. Use Chrome/Safari'],
          ['An item is missing from the list', 'Tell Cost Control so it is added to the count list or item group'],
        ]} />
      ),
    },
  ],
};

export const CC: Part = {
  key: 'cc', label: 'Cost Control', icon: <Calculator size={16} />,
  intro: 'For the Cost Control team: setting up stock opname, monitoring and reviewing counts, sending them to ESB and reading the outlet ratios. All pages are in the sidebar → Cost Control.',
  sections: [
    {
      id: 'cc-alur', title: 'Workflow at a glance',
      body: (
        <Table head={['When', 'What to do', 'Page']} rows={[
          ['Once / when something changes', 'Set count types & schedules, count lists, item groups, WIP recipes', 'Count types, Count lists, Item groups, Premix calculator'],
          ['Every morning (after 08:00)', 'Check branches that have not counted or are late', 'Monitor'],
          ['After a count is submitted', 'Approve or request a recount', 'Review'],
          ['When needed (optional)', 'Fill in or import counts for branches (they go to Review)', 'Enter / import SO'],
          ['After approval', 'Download the tidy SO report (xlsx)', 'SO report (xlsx)'],
          ['After approval', 'Make the ESB stock opname import file and upload it to ESB', 'ESB export'],
          ['After ESB processed it', 'Compare the counts with the ESB stock opname document', 'ESB comparison'],
          ['Weekly / monthly', 'Read COGS, raw material, espresso & usage ratios per outlet', 'Outlet ratio, COGS & usage'],
        ]} />
      ),
    },
    {
      id: 'cc-jenis', title: 'Count types (names, schedules, calendar)',
      body: (
        <>
          <Steps items={[
            <>Open <Go href="/cost-control/types">Count types</Go>. The month calendar shows every count on its date and time, computed with the same rules as the real schedule.</>,
            <>All times are <b>WIB</b> and the same for every branch. Click a count type card to change its <b>name</b> (what the crew sees), <b>schedule</b> (Daily: pick days; Weekly: pick the day; Monthly: day 1–31 or the last day; <b>On chosen dates</b>: tap the dates on the calendar), <b>window open/close</b>, <b>validity period</b>, <b>ESB purpose</b> and the <b>WIP form</b> switch.</>,
            <><b>Quick setup</b>: one tap for the usual schedules (Every day, Monday to Saturday, Every Monday, Last day of the month, Pick dates) and the usual count windows (e.g. 07:00–09:00, 21:00–23:00).</>,
            <>The calendar preview in the editor changes before you save. Tap Save.</>,
            <>A new count type: <Menu>New count type</Menu> (the code is made from the name). A new count type needs a count list before branches see it.</>,
          ]} />
          <Note>The ESB purpose must be exactly the purpose in ESB (e.g. STOCK OPNAME MINGGUAN (OUTLET)) because it goes into the import file.</Note>
        </>
      ),
    },
    {
      id: 'cc-daftar', title: 'Count lists',
      body: (
        <>
          <p className="text-sm text-slate-700">Every branch has its own list per count type. A branch without its own list uses its type’s <b>default list</b> (OUTLET, HUB_WH, …). The <b>weekly</b> lists of outlets and HUB WH follow the <i>Stock Opname Report of 07 Oct 2026</i> (items & units, including items with qty 0); the other lists come from the latest stock opname document in ESB.</p>
          <Steps items={[
            <>Open <Go href="/cost-control/lists">Count lists</Go>, pick a branch or a default, then the count type.</>,
            <>Add items (search a name/code or a whole category), set the <b>area</b>, the <b>pack unit</b> (the crew counts packs + loose), the <b>ESB unit</b> (the unit in the import file) and <b>photo required</b>. Save.</>,
            <>Items for many branches at once are easier to manage with <b>Item groups</b>.</>,
          ]} />
          <Note>Changes apply at once: a count in progress gets the new items; removed items leave a count in progress as long as they were not counted.</Note>
        </>
      ),
    },
    {
      id: 'cc-grup', title: 'Item groups',
      body: (
        <>
          <p className="text-sm text-slate-700">A group is a set of items made once and assigned to many branches (e.g. “Bar espresso”, “Packaging to go”). Changing a group changes every branch that uses it.</p>
          <Steps items={[
            <>Open <Go href="/cost-control/groups">Item groups</Go> → <Menu>New group</Menu>. Step 1 <b>Details</b>: name & description.</>,
            <>Step 2 <b>Items</b>: add a whole category or search items one by one; set area, pack, ESB unit, photo.</>,
            <>Step 3 <b>Branches</b>: pick the count types (one or more), filter by type & city, tick branches or <b>select all</b>. Create & assign.</>,
            <>An existing group: tabs <b>Items</b>, <b>Branches</b> (assign/unassign; a tick = assigned) and <b>Details</b> (name, inactive).</>,
          ]} />
          <p className="text-sm font-semibold text-slate-900">From the Cost Control template</p>
          <Steps items={[
            <><Menu>Import template</Menu> → choose the <i>TEMPLATE SO PER CATEGORY</i> file → <Menu>Check</Menu> (nothing saved yet) → <Menu>Import</Menu>. Every sheet becomes a group “Template SO …”, not assigned to branches. Importing again replaces the group’s items; branch assignments stay.</>,
            <>Products not in the item master show in the group as <b>Not in the item master</b>. Click <Menu>Create item</Menu> (code, name, category & unit come from the template), check and save: the item joins that group and every other group that lists it.</>,
            <>The template unit (GR, PCS, PACK@100PCS, ROLL@1000PCS, …) is <b>the unit the crew enters</b> during the count. Items without that unit: in the pack column choose <Menu>+ Add unit…</Menu> (e.g. PACK@100PCS = 100 PCS). The item search also has <Menu>New item</Menu> for products that do not exist yet.</>,
            <>Assign the group to branches in its <b>Branches</b> tab, for every count type used (e.g. weekly, monthly, daily).</>,
          ]} />
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">As soon as a branch has a group for a count type, that branch’s count form <b>shows the group’s items only</b> (the branch template). Own items of the count list that are not in the group are not counted. Count types without a group keep using their own count list. A count in progress follows at once.</p>
        </>
      ),
    },
    {
      id: 'cc-premix', title: 'Premix calculator & WIP recipes',
      body: (
        <>
          <p className="text-sm text-slate-700">Replaces the <i>Kalkulator Premix WIP – SO BAR KITCHEN</i> workbook. Active recipes are used by the calculator and the WIP form of the count.</p>
          <Steps items={[
            <><b>First import</b>: <Go href="/cost-control/premix">Premix calculator</Go> → tab <Menu>Import workbook</Menu> → choose the file → <Menu>Check</Menu> (nothing saved yet) → read the result (new/changed recipes, unmapped ingredients, recipes whose ingredients do not add up to 100%) → <Menu>Import</Menu>.</>,
            <><b>Map ingredients</b>: tab <Menu>WIP recipes</Menu> → open a recipe marked “needs fixing” → pick the <b>stock item</b> (ESB code) for every ingredient. For water choose “Not a stock item”. The choice is remembered for the next import.</>,
            <><b>Add ingredients from existing data</b>: the editor has panels <b>Item master</b> (per category), <b>ESB BOM</b> (one line or every ingredient of a BOM) and <b>Used in recipes</b>. Then enter the <b>grams per batch</b>.</>,
            <><b>Batch & units</b>: the batch is the grams of one pail for pail recipes. Units: Pail = 1 per batch, Teko = 3 per batch, Gram = 1 g (outlets enter grams). The share of every ingredient and the total show right away.</>,
            <><b>Versions</b>: changes are made as a draft → <Menu>Save & activate</Menu>. The old version is retired, but earlier counts keep the version they were counted with.</>,
            <><b>Calculator</b>: tab <Menu>Calculator</Menu> → enter quantities per unit → grams of every ingredient (rounded up like the workbook) → download CSV.</>,
          ]} />
          <Note tone="warn">A recipe with unmapped stock ingredients cannot be activated. Inactive recipes do not show in the calculator or the WIP form.</Note>
        </>
      ),
    },
    {
      id: 'cc-monitor', title: 'Monitor & Review',
      body: (
        <>
          <Steps items={[
            <><Go href="/cost-control/monitor">Monitor</Go>: today’s status of every branch (not started, in progress, submitted, late, missed).</>,
            <><Go href="/cost-control/reviews">Review</Go>: open a submitted count. Check the flagged lines (spike), evidence photos, location & lateness, and the premix grams (WIP). Once approved, <Menu>Evidence PDF</Menu> and <Menu>Photos (ZIP)</Menu> are available.</>,
            <><Menu>Download all branches (xlsx)</Menu> in Review downloads the approved/exported counts of the chosen period for every branch in one file.</>,
            <>Choose <Menu>Approve</Menu>, <Menu>Request recount</Menu> (pick lines & give a reason; the crew recounts only those lines) or <Menu>Cancel count</Menu> (the count can be started again).</>,
          ]} />
          <Note>The approver cannot be someone who counted that stock opname.</Note>
        </>
      ),
    },
    {
      id: 'cc-input', title: 'Enter / import counts for branches (optional)',
      body: (
        <>
          <p className="text-sm text-slate-700">When needed, Cost Control can fill in a branch’s count or import the counts of many branches from a file. This is <b>optional</b>: branches can still count themselves.</p>
          <Steps items={[
            <><Go href="/cost-control/entry">Enter / import SO</Go> → <Menu>Fill in a form</Menu>: pick the branch, count type and day (today or earlier) → <Menu>Open the form</Menu>. It is the crew’s form (items, units, premix in grams) without photos or location. Fill every line, then <Menu>Submit</Menu>.</>,
            <><Menu>Import a file</Menu>: choose a file in the <i>Stock Opname Report</i> layout (columns Branch, Product Code, Unit, Actual Opname Qty), the count type and day → <Menu>Check the file</Menu> (nothing saved yet; unknown branches/items/units are listed) → <Menu>Import</Menu>.</>,
            <>Entered or imported counts are <b>Submitted</b> and go to <Go href="/cost-control/reviews">Review</Go> marked “Entered/Imported by Cost Control”. <b>Another</b> Cost Control member approves them.</>,
          ]} />
          <Note>Branches that already have a count of the same type and day are skipped by the import (never overwritten).</Note>
        </>
      ),
    },
    {
      id: 'cc-laporan', title: 'SO report (xlsx)',
      body: (
        <Steps items={[
          <><Go href="/cost-control/reports">SO report (xlsx)</Go>: pick the period (at most 93 days), count type, branch and status (Approved + exported) → <Menu>Download .xlsx</Menu>.</>,
          <>Sheet <b>Stock Opname</b> has the layout of the Stock Opname Report (Date, Branch, Purpose, Product, Category, Unit, Actual Opname Qty, Price, Total Value) for every branch with filters & a total; sheet <b>Summary</b> one row per count (counted by, reviewed by, WIB times, items, value); sheet <b>WIP premix</b> the premix grams; and <b>one sheet per branch</b> (can be switched off). Dates read 14/09/2026.</>,
          <>Downloading the report does not change the status of the counts (unlike the ESB export).</>,
        ]} />
      ),
    },
    {
      id: 'cc-esb', title: 'ESB export & comparison',
      body: (
        <Steps items={[
          <><Go href="/cost-control/esb-export">ESB export</Go>: pick the day & count type → the ESB stock opname import file (sheet Worksheet) with the approved counts; quantities in ESB units, WIP grams included. The counts become “Exported”; the file can be downloaded again with the same content.</>,
          <>Upload the file to ESB (Stock Opname module) as usual.</>,
          <><Go href="/cost-control/esb-compare">ESB comparison</Go>: after ESB processed it, check per item the platform qty vs the ESB actual (must match) and the ESB system vs actual (difference in qty & value).</>,
        ]} />
      ),
    },
    {
      id: 'cc-rasio', title: 'Outlet ratio',
      body: (
        <>
          <p className="text-sm text-slate-700"><Go href="/cost-control/ratio">Outlet ratio</Go> builds the columns of the <i>CALF – Rasio Outlet</i> workbook from ESB data. Pick the month and period (W1 1–7, W2 1–14, W3 1–21, W4 1–28, whole month); download Excel.</p>
          <Table head={['Column', 'Source / formula']} rows={[
            ['Gross sales', 'Subtotal of the POS sales transactions (as the workbook)'],
            ['Revenue / net', 'Gross × (1 − MDR) when the month’s MDR is set; otherwise ESB net sales'],
            ['Purchases RM / Espresso / Dimsum', 'Purchase invoices from Calf Warehouse / Calf Central Kitchen / Calf Central Kitchen Food'],
            ['COGS value', 'RM + Espresso + Dimsum'],
            ['RM ratio · Espresso ratio', '(RM + Dimsum) ÷ net · Espresso ÷ net'],
            ['COGS ratio gross · net', 'COGS ÷ gross · COGS ÷ net'],
            ['Opening SO · Closing SO', 'Value of the ESB SO document the day before the period & on the last day (or the corrected value)'],
            ['Usage · usage ratio', 'COGS + opening SO − closing SO; ÷ gross & ÷ net'],
            ['Δ COGS − usage', 'COGS ratio net − usage ratio net'],
            ['Non sales · Item journal', 'Bills “other cost” · item journal value (waste, QC)'],
          ]} />
          <Steps items={[
            <><b>Correct an SO value</b>: click the opening/closing SO value → enter the value to use & the reason (recorded with your name). “Use the ESB value” undoes it.</>,
            <><b>MDR</b>: enter the MDR percent per outlet in the MDR column (period within one month) so the net ratios match the workbook.</>,
          ]} />
        </>
      ),
    },
  ],
};

export const ADMIN: Part = {
  key: 'admin', label: 'Admin (User Accounts)', icon: <ShieldCheck size={16} />,
  intro: 'For super admins: creating accounts, assigning branches, choosing the pages each role or user opens.',
  sections: [
    {
      id: 'ad-user', title: 'Creating a PIC / Cost Control account',
      body: (
        <Steps items={[
          <><Go href="/users">User Accounts</Go> → <Menu>New user</Menu>. Enter the name, phone, <b>job title</b> & <b>department</b> (pick from the list or type a new name → “Add … to the list”).</>,
          <>Choose the <b>role</b>: User (data of the assigned branches), Cost Control (every branch + the Cost Control pages), Super Admin (everything).</>,
          <><b>Page access</b>: the role’s pages are ticked; tick/untick to add or remove pages for this user only.</>,
          <><b>Branches</b> (User role): pick outlets; for HUB WH / HUB CK pick the location without an ESB code. Save and share the login.</>,
        ]} />
      ),
    },
    {
      id: 'ad-role', title: 'Roles & pages, job titles & departments',
      body: (
        <Steps items={[
          <><Menu>Roles & pages</Menu>: the matrix of pages per role. Changes apply to every user of the role within a minute.</>,
          <>The <b>Guide</b> (book icon in the header, top right) is a page too: untick it for a role (or a single user) to hide the icon.</>,
          <><Menu>Job titles & departments</Menu>: add, rename (accounts follow) or hide names.</>,
          <>User Accounts and Activity Logs are always for super admins only.</>,
        ]} />
      ),
    },
  ],
};

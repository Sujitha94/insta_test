"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Printer, RotateCcw, ArrowRight, Package, MapPin, X } from "lucide-react"
import OrderPrintPage from "@/components/OrderPrintPage"
import ShippingLabelTemplate from "@/components/ShippingLabelTemplate"
import { publicApi } from "@/utils/axios"
import { jsPDF } from "jspdf"

// Add JsBarcode type declaration
declare global {
  interface Window {
    JsBarcode: any
  }
}

// Types definition
interface TemplateType {
  id: string
  name: string
  width: number
  height: number
  className?: string
  description?: string
  isDefault?: boolean
  margins?: {
    top: number
    right: number
    bottom: number
    left: number
  }
  scaleFactor?: number
  printSettings?: {
    fitToPage: boolean
    respectBoundaries: boolean
  }
}

interface FromAddressType {
  name: string
  street: string
  city: string
  state: string
  zipCode: string
  phone: string
  tenent_id?: string
}

interface OrderType {
  id: string
  name: string
  toAddress: {
    name: string
    street: string
    city: string
    state: string
    zipCode: string
    phone: string
  }
  isPrepaid: boolean
  orderDate: string
  shipVia: string
  products: Array<{ name: string; quantity: number }>
  totalItems: number
  packedBy: string
  weight: string
}

interface BillResponseType {
  bill_id: string
  customer_details: {
    name: string
    flat_no?: string
    street: string
    district: string
    state: string
    pincode: string
    phone: string
  }
  bill_details: {
    bill_no: string | number
    date: string
    time: string
  }
  shipping_details?: {
    method_name?: string
    weight?: string
  }
  product_details: Array<{
    productName: string
    quantity: number
  }>
  organisation_details: {
    Name: string
    street: string
    district: string
    state: string
    pincode: string
    phone: string
  }
}

interface PrintManagementProps {
  orderData?: OrderType
}

// UNIFIED LAYOUT DATA STRUCTURE
interface UnifiedLayoutData {
  templateWidth: number
  templateHeight: number
  templateWidthPt: number
  templateHeightPt: number
  baseFontSize: number
  titleFontSize: number
  smallFontSize: number
  lineHeight: number
  letterSpacing: string
  marginPx: number
  marginPt: number
  paddingPx: number
  paddingPt: number
  borderWidthPx: number
  borderWidthPt: number
  topPaddingAdjustment: number
  sectionSpacing: number
  toAddressBoxHeight: number
  detailBoxHeight: number
  barcodeWidth: number
  barcodeHeight: number
  formattedOrder: any
  fromAddress: any
  productText: string
}

const PrintManagement = ({ orderData }: PrintManagementProps) => {
  const [step, setStep] = useState(1)
  const [fromAddress, setFromAddress] = useState<FromAddressType>({
    name: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
  })
  const [hasCheckedForAddress, setHasCheckedForAddress] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null)
  const [templates, setTemplates] = useState<TemplateType[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showTemplateEdit, setShowTemplateEdit] = useState(false)
  const [bills, setBills] = useState(0)
  const [billId, setBillId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<OrderType | null>(null)
  const [tenentId, setTenentId] = useState<string | null>(null)
  const [isAddressSaved, setIsAddressSaved] = useState(false)
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [printHistory, setPrintHistory] = useState<string[]>([])
  const [showPrintHistory, setShowPrintHistory] = useState(false)
  const [activePrintSection, setActivePrintSection] = useState<"labels" | "single">("labels")

  // Bulk Preview State
  const [showBulkPreview, setShowBulkPreview] = useState(false)
  const [bulkPreviewData, setBulkPreviewData] = useState<{
    aggregatedProducts: { productName: string; quantity: number }[]
    totals: { totalBills: number; totalItems: number }
  }>({
    aggregatedProducts: [],
    totals: { totalBills: 0, totalItems: 0 }
  })

  const defaultOrder: OrderType = {
    id: "120873",
    name: "Vaseegrah Veda Order",
    toAddress: {
      name: "Pramoth Murali",
      street: "11-A, Periyar street",
      city: "Mettupalayam",
      state: "Thiruvarur, TN",
      zipCode: "610001",
      phone: "09940904131 9940904131",
    },
    isPrepaid: true,
    orderDate: "4/7/2025, 12:36:27 AM",
    shipVia: "Free shipping (ST Co.)",
    products: [
      { name: "Almond oil - 35ml", quantity: 2 },
      { name: "Country Jaggery", quantity: 1 },
      { name: "Kids Tooth Powder - 50g", quantity: 2 },
      { name: "Kids Tooth Brush", quantity: 1 },
    ],
    totalItems: 6,
    packedBy: "Vaseegrah Team",
    weight: "0.5 kg",
  }

  const order = currentOrder || orderData || defaultOrder

  useEffect(() => {
    const tenentIdFromStorage = localStorage.getItem("tenentid")
    setTenentId(tenentIdFromStorage)

    const history = localStorage.getItem("printHistory")
    if (history) {
      try {
        setPrintHistory(JSON.parse(history))
      } catch (e) {
        console.error("Error parsing print history:", e)
        setPrintHistory([])
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined" && !window.JsBarcode) {
      const script = document.createElement("script")
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"
      script.async = true
      document.head.appendChild(script)
    }
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const response = await publicApi.get("/api/printingroute/templates", {
        headers: {
          "tenent-id": tenentId || "",
        },
      })

      if (response.data && response.data.success && response.data.data) {
        setTemplates(response.data.data)
        const defaultTemplate = response.data.data.find((t: TemplateType) => t.isDefault)
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate)
        }
      }
    } catch (error) {
      console.error("Error fetching templates:", error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  useEffect(() => {
    if (tenentId) {
      fetchTemplates()
    }
  }, [tenentId])

  const fetchFromAddress = async () => {
    try {
      setIsLoading(true)
      const response = await publicApi.get("/api/printingroute/from-address", {
        headers: {
          "tenent-id": tenentId || "",
        },
      })

      if (response.data && response.data.data) {
        const addressData = response.data.data
        setFromAddress({
          name: addressData.name,
          street: addressData.street,
          city: addressData.city,
          state: addressData.state,
          zipCode: addressData.zipCode,
          phone: addressData.phone,
        })
        setIsAddressSaved(true)

        if (addressData.templateId) {
          const foundTemplate = templates.find((t) => t.id === addressData.templateId)
          if (foundTemplate) {
            setSelectedTemplate(foundTemplate)
          } else {
            fetchTemplates()
          }
        }

        return true
      }
      setIsAddressSaved(false)
      return false
    } catch (error) {
      console.error("Error fetching from address:", error)
      setIsAddressSaved(false)
      return false
    } finally {
      setIsLoading(false)
      setHasCheckedForAddress(true)
    }
  }

  useEffect(() => {
    if (tenentId && !hasCheckedForAddress) {
      fetchFromAddress()
    }
  }, [tenentId, hasCheckedForAddress])

  const previewFromAddress: FromAddressType = {
    name: fromAddress.name || "VASEEGRAH VEDA",
    street: fromAddress.street || "No:7 Vijaya Nagar",
    city: fromAddress.city || "Srinivasapuram (Post)",
    state: fromAddress.state || "Tamil Nadu",
    zipCode: fromAddress.zipCode || "613009",
    phone: fromAddress.phone || "8248817165",
  }

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await publicApi.get("/api/printingroute/pending-count", {
          headers: {
            "tenent-id": tenentId || "",
          },
        })
        if (response.data && response.data.count !== undefined) {
          setBills(response.data.count)
        }
      } catch (error) {
        console.error("Error fetching pending count:", error)
      }
    }

    if (tenentId) {
      fetchPendingCount()
    }
  }, [tenentId])

  const handleFromAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFromAddress((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmitFromAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!fromAddress.name || !fromAddress.street || !fromAddress.city) {
      alert("Please fill in the required fields")
      return
    }

    try {
      setIsLoading(true)
      const addressData = {
        ...fromAddress,
        tenent_id: tenentId,
        templateId: selectedTemplate?.id || "4x6",
      }

      const response = await publicApi.post("/api/printingroute/from-address", addressData, {
        headers: {
          "tenent-id": tenentId || "",
        },
      })

      if (response.data.success) {
        setIsAddressSaved(true)
        setIsEditingAddress(false)
        setShowTemplateEdit(false)
      } else {
        alert("Error saving address: " + response.data.message)
      }
    } catch (error: any) {
      console.error("Error saving address:", error)
      alert("Failed to save address: " + (error.response?.data?.message || error.message))
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    if (!selectedTemplate) {
      alert("Please select a template")
      return
    }
    setStep(2)
  }

  const handleTemplateSelect = async (template: TemplateType) => {
    setSelectedTemplate(template)

    try {
      setIsLoading(true)

      await publicApi.post(
        "/api/printingroute/templates",
        {
          tenent_id: tenentId,
          templateId: template.id,
          name: template.name,
          description: template.description || "",
          width: template.width,
          height: template.height,
          className: template.className || "",
          isDefault: true,
        },
        {
          headers: {
            "tenent-id": tenentId || "",
          },
        },
      )

      if (isAddressSaved && !isEditingAddress) {
        updateAddressWithTemplate(template.id)
      }

      fetchTemplates()
    } catch (error) {
      console.error("Error saving template preference:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateAddressWithTemplate = async (templateId: string) => {
    try {
      setIsLoading(true)
      const addressData = {
        ...fromAddress,
        tenent_id: tenentId,
        templateId: templateId,
      }

      await publicApi.post("/api/printingroute/from-address", addressData, {
        headers: {
          "tenent-id": tenentId || "",
        },
      })
    } catch (error) {
      console.error("Error updating template preference:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // UNIFIED LAYOUT GENERATOR
  const generateUnifiedLayoutData = (
    billData: any,
    template: TemplateType | null,
    fromAddr: FromAddressType,
  ): UnifiedLayoutData => {
    const templateWidth = template?.width || 384
    const templateHeight = template?.height || 384
    const templateWidthPt = templateWidth * 0.75
    const templateHeightPt = templateHeight * 0.75

    let styling
    if (template?.id === "2x4" || templateWidth <= 192) {
      styling = {
        baseFontSize: 6,
        titleFontSize: 7,
        smallFontSize: 5,
        lineHeight: 1.0,
        letterSpacing: "normal",
        marginPx: 8,
        marginPt: 6,
        paddingPx: 3,
        paddingPt: 2.25,
        borderWidthPx: 1.5,
        borderWidthPt: 1.125,
        topPaddingAdjustment: 4,
        sectionSpacing: 4,
        barcodeWidth: 1.0,
        barcodeHeight: 30,
      }
    } else if (template?.id === "4x4" || templateWidth <= 384) {
      styling = {
        baseFontSize: 9,
        titleFontSize: 10,
        smallFontSize: 8,
        lineHeight: 1.1,
        letterSpacing: "normal",
        marginPx: 8,
        marginPt: 6,
        paddingPx: 4,
        paddingPt: 3,
        borderWidthPx: 1.5,
        borderWidthPt: 1.125,
        topPaddingAdjustment: 4,
        sectionSpacing: 4,
        barcodeWidth: 1.0,
        barcodeHeight: 35,
      }
    } else {
      styling = {
        baseFontSize: 11,
        titleFontSize: 12,
        smallFontSize: 10,
        lineHeight: 1.2,
        letterSpacing: "normal",
        marginPx: 8,
        marginPt: 6,
        paddingPx: 5,
        paddingPt: 3.75,
        borderWidthPx: 1.5,
        borderWidthPt: 1.125,
        topPaddingAdjustment: 4,
        sectionSpacing: 4,
        barcodeWidth: 1.0,
        barcodeHeight: 40,
      }
    }

    const formattedOrder = {
      id: billData.bill_id,
      name: billData.customer_details.name,
      toAddress: {
        name: billData.customer_details.name,
        street: billData.customer_details.street,
        city: billData.customer_details.district,
        state: billData.customer_details.state,
        zipCode: billData.customer_details.pincode,
        phone: billData.customer_details.phone,
      },
      shipVia: billData.shipping_details?.method_name || "Standard Shipping",
      products: billData.product_details,
      totalItems: billData.product_details.reduce((total: number, product: any) => total + product.quantity, 0),
      orderDate: `${billData.bill_details.date}, ${billData.bill_details.time}`,
      weight: billData.shipping_details?.weight || "0.5 kg"
    }

    const formattedFromAddress = {
      name: billData.organisation_details?.Name || fromAddr.name,
      street: billData.organisation_details?.street || fromAddr.street,
      city: billData.organisation_details?.district || fromAddr.city,
      state: billData.organisation_details?.state || fromAddr.state,
      zipCode: billData.organisation_details?.pincode || fromAddr.zipCode,
      phone: billData.organisation_details?.phone || fromAddr.phone,
    }

    const formatProductsList = (products: Array<{ productName?: string; name?: string; quantity: number }>): string => {
      if (!products || products.length === 0) {
        return "No products"
      }

      if (template?.id === "2x4") {
        return products
          .map((product) => {
            const productName = product.productName || product.name
            const truncatedName =
              productName && productName.length > 10 ? productName.substring(0, 9) + "…" : productName
            return `${truncatedName} × ${product.quantity}`
          })
          .join(", ")
      }

      return products
        .map((product) => {
          const productName = product.productName || product.name
          return `${productName} × ${product.quantity}`
        })
        .join(", ")
    }

    const productText = formatProductsList(formattedOrder.products)

    const toAddressBoxHeight = templateHeightPt * 0.28
    const detailBoxHeight = templateHeightPt * 0.22

    return {
      templateWidth,
      templateHeight,
      templateWidthPt,
      templateHeightPt,
      ...styling,
      toAddressBoxHeight,
      detailBoxHeight,
      formattedOrder,
      fromAddress: formattedFromAddress,
      productText,
    }
  }

  // UNIFIED BARCODE GENERATOR
  const generateBarcodeImage = async (text: string, layout: UnifiedLayoutData): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = layout.barcodeWidth * 60
        canvas.height = layout.barcodeHeight

        if (typeof window !== "undefined" && window.JsBarcode) {
          window.JsBarcode(canvas, text, {
            format: "CODE128",
            width: layout.barcodeWidth,
            height: layout.barcodeHeight,
            displayValue: false,
            margin: 0,
            background: "#ffffff",
            lineColor: "#000000",
          })
          resolve(canvas.toDataURL("image/png"))
        } else {
          resolve("")
        }
      } catch (error) {
        console.warn("Barcode generation failed:", error)
        resolve("")
      }
    })
  }

  // PDF GENERATOR
  const downloadBillDataAsPDF = async (
    billId: string,
    billData?: any,
    templateToUse?: TemplateType
  ) => {
    try {
      let dataToDownload = billData

      if (!dataToDownload && billId) {
        const response = await publicApi.get(`/api/printingroute/print-bill/${billId}`, {
          headers: { "tenent-id": tenentId || "" },
        })
        dataToDownload = response.data
      }

      if (!dataToDownload) {
        console.error("No bill data available for download")
        alert("No bill data available for PDF generation")
        return
      }

      const templateForPdf = templateToUse || selectedTemplate

      if (!templateForPdf) {
        console.error("No template available for PDF generation")
        alert("Please select a template before generating PDF")
        return
      }

      const layout = generateUnifiedLayoutData(dataToDownload, templateForPdf, previewFromAddress)
      const barcodeDataUrl = await generateBarcodeImage(layout.formattedOrder.id, layout)

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [layout.templateWidthPt, layout.templateHeightPt],
      })

      let yPos = layout.marginPt
      doc.setFont("helvetica", "normal")
      doc.setFontSize(layout.baseFontSize)

      // Header
      doc.text(`Ship Via: ${layout.formattedOrder.shipVia}`, layout.marginPt, yPos)
      yPos += 14

      // Order ID
      const title = `${layout.fromAddress.name} Order ID: ${layout.formattedOrder.id}`
      const titleWidth = doc.getTextWidth(title)
      doc.text(title, (layout.templateWidthPt - titleWidth) / 2, yPos)
      yPos += 12

      // Barcode
      if (barcodeDataUrl) {
        const barcodeWidth = layout.barcodeWidth * 60
        const barcodeHeight = layout.barcodeHeight
        doc.addImage(
          barcodeDataUrl,
          "PNG",
          (layout.templateWidthPt - barcodeWidth) / 2,
          yPos,
          barcodeWidth,
          barcodeHeight
        )
        yPos += barcodeHeight + 8
      } else {
        yPos += layout.barcodeHeight + 8
      }

      // TO Address Box
      doc.setLineWidth(layout.borderWidthPt)
      doc.rect(layout.marginPt, yPos, layout.templateWidthPt - 2 * layout.marginPt, layout.toAddressBoxHeight)

      let addrY = yPos + 12
      doc.setFont("helvetica", "bold")
      doc.setFontSize(layout.titleFontSize)
      doc.text(`TO ${layout.formattedOrder.toAddress.name}`, layout.marginPt + layout.paddingPt, addrY)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(layout.baseFontSize)
      addrY += 12

      const addressMaxWidth = layout.templateWidthPt - (2 * layout.marginPt) - (2 * layout.paddingPt)
      const streetLines = doc.splitTextToSize(layout.formattedOrder.toAddress.street, addressMaxWidth)
      streetLines.forEach((line: string) => {
        doc.text(line, layout.marginPt + layout.paddingPt, addrY)
        addrY += 10
      })

      doc.text(layout.formattedOrder.toAddress.city, layout.marginPt + layout.paddingPt, addrY)
      addrY += 10
      doc.text(`${layout.formattedOrder.toAddress.state} - ${layout.formattedOrder.toAddress.zipCode}`, layout.marginPt + layout.paddingPt, addrY)
      addrY += 10
      doc.text(`Phone: ${layout.formattedOrder.toAddress.phone}`, layout.marginPt + layout.paddingPt, addrY)

      yPos += layout.toAddressBoxHeight + layout.sectionSpacing

      // FROM + ORDER Details
      const boxWidth = (layout.templateWidthPt - 3 * layout.marginPt) / 2

      // FROM Box
      doc.rect(layout.marginPt, yPos, boxWidth, layout.detailBoxHeight)
      let fy = yPos + 12
      doc.setFont("helvetica", "bold")
      doc.setFontSize(layout.titleFontSize)
      doc.text("From:", layout.marginPt + layout.paddingPt, fy)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(layout.smallFontSize)
      fy += 12
      doc.text(layout.fromAddress.name, layout.marginPt + layout.paddingPt, fy)
      fy += 10
      doc.text(layout.fromAddress.street, layout.marginPt + layout.paddingPt, fy)
      fy += 10
      doc.text(layout.fromAddress.city, layout.marginPt + layout.paddingPt, fy)
      fy += 10
      doc.text(`${layout.fromAddress.state}-${layout.fromAddress.zipCode}`, layout.marginPt + layout.paddingPt, fy)
      fy += 10
      doc.text(`Mobile: ${layout.fromAddress.phone}`, layout.marginPt + layout.paddingPt, fy)

      // ORDER Box
      const rx = layout.marginPt + boxWidth + layout.marginPt
      doc.rect(rx, yPos, boxWidth, layout.detailBoxHeight)
      let ry = yPos + 12
      doc.setFont("helvetica", "bold")
      doc.setFontSize(layout.titleFontSize)
      doc.text("Prepaid Order:", rx + layout.paddingPt, ry)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(layout.smallFontSize)
      ry += 12
      doc.text(`Date: ${layout.formattedOrder.orderDate}`, rx + layout.paddingPt, ry)
      ry += 10
      doc.text(`Weight: ${layout.formattedOrder.weight || "0.5 kg"}`, rx + layout.paddingPt, ry)
      ry += 10
      doc.text(`No. of Items: ${layout.formattedOrder.totalItems}`, rx + layout.paddingPt, ry)
      ry += 10
      doc.text("Source: Instagram", rx + layout.paddingPt, ry)
      ry += 10
      doc.text("Packed By: Team", rx + layout.paddingPt, ry)

      yPos += layout.detailBoxHeight + layout.sectionSpacing

      // Products Box
      const remainingHeight = layout.templateHeightPt - yPos - layout.marginPt
      doc.rect(layout.marginPt, yPos, layout.templateWidthPt - 2 * layout.marginPt, remainingHeight)

      let py = yPos + 12
      doc.setFont("helvetica", "bold")
      doc.setFontSize(layout.titleFontSize)
      doc.text("Products:", layout.marginPt + layout.paddingPt, py)

      py += 12
      doc.setFont("helvetica", "normal")
      doc.setFontSize(layout.smallFontSize)

      const maxWidth = layout.templateWidthPt - 2 * layout.marginPt - 2 * layout.paddingPt
      const productLines = doc.splitTextToSize(layout.productText, maxWidth)

      productLines.forEach((line: string) => {
        if (py < layout.templateHeightPt - layout.marginPt - 5) {
          doc.text(line, layout.marginPt + layout.paddingPt, py)
          py += 10
        }
      })

      const fileName = `bill_${layout.templateWidth}x${layout.templateHeight}_${layout.formattedOrder.id}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error("PDF generation error:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  // BULK PDF GENERATOR
  const downloadBulkBillsDataAsPDF = async (bills: BillResponseType[]) => {
    try {
      if (bills.length === 0) {
        console.error("No bills available for bulk PDF generation")
        return
      }

      const layout = generateUnifiedLayoutData(bills[0], selectedTemplate, previewFromAddress)

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [layout.templateWidthPt, layout.templateHeightPt],
      })

      for (let index = 0; index < bills.length; index++) {
        const bill = bills[index]
        const layout = generateUnifiedLayoutData(bill, selectedTemplate, previewFromAddress)

        let yPos = layout.marginPt
        doc.setFont("helvetica", "normal")
        doc.setFontSize(layout.baseFontSize)

        doc.text(`Ship Via: ${layout.formattedOrder.shipVia}`, layout.marginPt, yPos)
        yPos += 14

        const title = `${layout.fromAddress.name} Order ID: ${layout.formattedOrder.id}`
        const titleWidth = doc.getTextWidth(title)
        doc.text(title, (layout.templateWidthPt - titleWidth) / 2, yPos)
        yPos += 12

        const barcodeDataUrl = await generateBarcodeImage(layout.formattedOrder.id, layout)
        if (barcodeDataUrl) {
          const barcodeWidth = layout.barcodeWidth * 60
          const barcodeHeight = layout.barcodeHeight
          doc.addImage(
            barcodeDataUrl,
            "PNG",
            (layout.templateWidthPt - barcodeWidth) / 2,
            yPos,
            barcodeWidth,
            barcodeHeight
          )
          yPos += barcodeHeight + 8
        } else {
          yPos += layout.barcodeHeight + 8
        }

        const reducedToAddressBoxHeight = layout.toAddressBoxHeight - 12
        doc.setLineWidth(layout.borderWidthPt)
        doc.rect(layout.marginPt, yPos, layout.templateWidthPt - 2 * layout.marginPt, reducedToAddressBoxHeight)

        let addrY = yPos + 10
        doc.setFont("helvetica", "bold")
        doc.setFontSize(layout.titleFontSize)
        doc.text(`TO ${layout.formattedOrder.toAddress.name}`, layout.marginPt + layout.paddingPt, addrY)

        doc.setFont("helvetica", "normal")
        doc.setFontSize(layout.baseFontSize)
        addrY += 10

        const addressMaxWidth = layout.templateWidthPt - (2 * layout.marginPt) - (2 * layout.paddingPt)
        const streetLines = doc.splitTextToSize(layout.formattedOrder.toAddress.street, addressMaxWidth)
        streetLines.forEach((line: string) => {
          doc.text(line, layout.marginPt + layout.paddingPt, addrY)
          addrY += 9
        })

        doc.text(layout.formattedOrder.toAddress.city, layout.marginPt + layout.paddingPt, addrY)
        addrY += 9
        doc.text(`${layout.formattedOrder.toAddress.state} - ${layout.formattedOrder.toAddress.zipCode}`, layout.marginPt + layout.paddingPt, addrY)
        addrY += 9
        doc.text(`Phone: ${layout.formattedOrder.toAddress.phone}`, layout.marginPt + layout.paddingPt, addrY)

        yPos += reducedToAddressBoxHeight + layout.sectionSpacing

        const boxWidth = (layout.templateWidthPt - 3 * layout.marginPt) / 2

        doc.rect(layout.marginPt, yPos, boxWidth, layout.detailBoxHeight)
        let fy = yPos + 12
        doc.setFont("helvetica", "bold")
        doc.setFontSize(layout.titleFontSize)
        doc.text("From:", layout.marginPt + layout.paddingPt, fy)

        doc.setFont("helvetica", "normal")
        doc.setFontSize(layout.smallFontSize)
        fy += 12
        doc.text(layout.fromAddress.name, layout.marginPt + layout.paddingPt, fy)
        fy += 10
        doc.text(layout.fromAddress.street, layout.marginPt + layout.paddingPt, fy)
        fy += 10
        doc.text(layout.fromAddress.city, layout.marginPt + layout.paddingPt, fy)
        fy += 10
        doc.text(`${layout.fromAddress.state}-${layout.fromAddress.zipCode}`, layout.marginPt + layout.paddingPt, fy)
        fy += 10
        doc.text(`Mobile: ${layout.fromAddress.phone}`, layout.marginPt + layout.paddingPt, fy)

        const rx = layout.marginPt + boxWidth + layout.marginPt
        doc.rect(rx, yPos, boxWidth, layout.detailBoxHeight)
        let ry = yPos + 12
        doc.setFont("helvetica", "bold")
        doc.setFontSize(layout.titleFontSize)
        doc.text("Prepaid Order:", rx + layout.paddingPt, ry)

        doc.setFont("helvetica", "normal")
        doc.setFontSize(layout.smallFontSize)
        ry += 12
        doc.text(`Date: ${layout.formattedOrder.orderDate}`, rx + layout.paddingPt, ry)
        ry += 10
        doc.text(`Weight: ${layout.formattedOrder.weight || "0.5 kg"}`, rx + layout.paddingPt, ry)
        ry += 10
        doc.text(`No. of Items: ${layout.formattedOrder.totalItems}`, rx + layout.paddingPt, ry)
        ry += 10
        doc.text("Source: Instagram", rx + layout.paddingPt, ry)
        ry += 10
        doc.text("Packed By: Team", rx + layout.paddingPt, ry)

        yPos += layout.detailBoxHeight + layout.sectionSpacing + 6

        const remainingHeight = layout.templateHeightPt - yPos - layout.marginPt + 6
        doc.rect(layout.marginPt, yPos, layout.templateWidthPt - 2 * layout.marginPt, remainingHeight)

        let py = yPos + 12
        doc.setFont("helvetica", "bold")
        doc.setFontSize(layout.titleFontSize)
        doc.text("Products:", layout.marginPt + layout.paddingPt, py)

        py += 12
        doc.setFont("helvetica", "normal")
        doc.setFontSize(layout.smallFontSize)

        const maxWidth = layout.templateWidthPt - 2 * layout.marginPt - 2 * layout.paddingPt
        const productLines = doc.splitTextToSize(layout.productText, maxWidth)

        productLines.forEach((line: string) => {
          if (py < layout.templateHeightPt - layout.marginPt - 5) {
            doc.text(line, layout.marginPt + layout.paddingPt, py)
            py += 10
          }
        })

        if (index < bills.length - 1) {
          doc.addPage()
        }
      }

      const fileName = `bulk_bills_${layout.templateWidth}x${layout.templateHeight}_${selectedTemplate?.name || "default"}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error("Error downloading bulk shipping labels as PDF:", error)
      alert("Error generating bulk PDF. Please try again.")
    }
  }

  const handlePrintBill = async (billId: string) => {
    if (!billId) {
      alert('Please enter a bill ID')
      return
    }
    if (!selectedTemplate) {
      alert("Please select a template before printing")
      return
    }
    try {
      setIsLoading(true)

      const response = await publicApi.get(`/api/printingroute/print-bill/${billId}`, {
        headers: {
          'tenent-id': tenentId || ''
        }
      })

      if (!response.data) {
        throw new Error('No data returned from server')
      }

      const responseOrder: BillResponseType = response.data

      const formattedOrder: OrderType = {
        id: responseOrder.bill_id,
        name: responseOrder.customer_details.name,
        toAddress: {
          name: responseOrder.customer_details.name,
          street: responseOrder.customer_details.street,
          city: responseOrder.customer_details.district,
          state: responseOrder.customer_details.state,
          zipCode: responseOrder.customer_details.pincode,
          phone: responseOrder.customer_details.phone
        },
        isPrepaid: true,
        orderDate: `${responseOrder.bill_details.date}, ${responseOrder.bill_details.time}`,
        shipVia: responseOrder.shipping_details?.method_name || 'Standard Shipping',
        products: responseOrder.product_details.map(product => ({
          name: product.productName,
          quantity: product.quantity
        })),
        totalItems: responseOrder.product_details.reduce((total, product) => total + product.quantity, 0),
        packedBy: 'Team',
        weight: responseOrder.shipping_details?.weight || '0.5 kg'
      }

      setCurrentOrder(formattedOrder)

      const updatedHistory = [billId, ...printHistory.filter(id => id !== billId)].slice(0, 10)
      setPrintHistory(updatedHistory)
      localStorage.setItem('printHistory', JSON.stringify(updatedHistory))

      const templateWidth = (selectedTemplate?.width || 384) / 96
      const templateHeight = (selectedTemplate?.height || 384) / 96

      const getFontSizes = (template: TemplateType | null) => {
        if (template?.id === '2x4' || (template?.width && template.width <= 192)) {
          return {
            baseFontSize: 5,
            titleFontSize: 6,
            smallFontSize: 4,
            letterSpacing: '-0.4px',
            lineHeight: 0.8,
            padding: '1px',
            borderWidth: '0.5px'
          }
        }
        else if (template?.id === '4x4' || (template?.width && template.width <= 384)) {
          return {
            baseFontSize: 11,
            titleFontSize: 12,
            smallFontSize: 10,
            letterSpacing: 'normal',
            lineHeight: 1.2,
            padding: '4px',
            borderWidth: '1px'
          }
        }
        else {
          return {
            baseFontSize: 14,
            titleFontSize: 16,
            smallFontSize: 12,
            letterSpacing: 'normal',
            lineHeight: 1.3,
            padding: '6px',
            borderWidth: '1px'
          }
        }
      }

      const barcodeWidth = selectedTemplate?.id === '2x4' ? 0.8 : 1.2
      const barcodeHeight = selectedTemplate?.id === '2x4' ? 25 : 40

      const fontSizes = getFontSizes(selectedTemplate)

      const formatProductsList = (products: Array<{ productName?: string; name?: string; quantity: number }>): string => {
        if (!products || products.length === 0) {
          return "No products"
        }

        const totalProducts = products.length

        let fontSize = fontSizes.smallFontSize
        let lineHeight = fontSizes.lineHeight

        if (totalProducts > 6) {
          fontSize = Math.max(fontSize - 1, 3)
          lineHeight = Math.max(lineHeight - 0.1, 0.7)
        }

        if (totalProducts > 10) {
          fontSize = Math.max(fontSize - 1, 2)
          lineHeight = Math.max(lineHeight - 0.1, 0.6)
        }

        if (selectedTemplate?.id === '2x4') {
          return products.map(product => {
            const productName = product.productName || product.name
            const truncatedName = productName && productName.length > 10
              ? productName.substring(0, 9) + '…'
              : productName
            return `${truncatedName} × ${product.quantity}`
          }).join(', ')
        }

        return products.map(product => {
          const productName = product.productName || product.name
          return `${productName} × ${product.quantity}`
        }).join(', ')
      }

      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert('Unable to open print window. Please disable your pop-up blocker and try again.')
        return
      }

      printWindow.document.open()
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Print Label - ${billId}</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"></script>
            <style>
              @media print {
                @page {
                  size: ${templateWidth}in ${templateHeight}in;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  width: ${selectedTemplate?.width || 384}px !important;
                  height: ${selectedTemplate?.height || 384}px !important;
                  max-height: ${selectedTemplate?.height || 384}px !important;
                  overflow: hidden;
                }
                .container {
                  width: 100% !important;
                  height: 100% !important;
                  page-break-after: avoid;
                  overflow: hidden !important;
                  box-sizing: border-box;
                  padding: ${fontSizes.padding} !important;
                  padding-top: 8px !important;
                  padding-left: 12px !important;
                  padding-right: 12px !important;
                  padding-bottom: 8px !important;
                  border: 0 !important;
                }
              }

              html, body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                font-size: ${fontSizes.baseFontSize}px;
                line-height: ${fontSizes.lineHeight};
                font-weight: 500;
                letter-spacing: ${fontSizes.letterSpacing};
              }

              .container {
                width: ${selectedTemplate?.width || 384}px;
                height: ${selectedTemplate?.height || 384}px;
                margin: 0 auto;
                padding: ${fontSizes.padding};
                padding-top: 8px;
                padding-left: 12px;
                padding-right: 12px;
                padding-bottom: 8px;
                box-sizing: border-box;
                position: relative;
                border: 0;
                overflow: hidden;
              }

              .header {
                font-size: ${fontSizes.titleFontSize}px;
                font-weight: bold;
                margin-top: 5px;
                margin-bottom: 1px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .order-id {
                font-size: ${fontSizes.titleFontSize}px;
                font-weight: bold;
                margin-bottom: 2px;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .barcode-wrapper {
                text-align: center;
                margin: 4px auto;
                height: ${barcodeHeight}px;
                display: flex;
                justify-content: center;
                align-items: center;
                width: 90%;
              }

              .barcode-img {
                max-height: 100%;
                max-width: 100%;
              }

              .address-box {
                border: ${fontSizes.borderWidth} solid #000;
                padding: ${fontSizes.padding};
                margin-bottom: 2px;
                min-height: 80px;
                overflow: hidden;
              }

              .to-name {
                font-weight: bold;
                font-size: ${fontSizes.titleFontSize}px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }

              .address-line {
                white-space: normal;
                word-wrap: break-word;
                line-height: ${fontSizes.lineHeight};
                font-size: ${fontSizes.baseFontSize}px;
                overflow: hidden;
              }

              .details-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 2px;
                margin-bottom: 2px;
              }

              .detail-box {
                border: ${fontSizes.borderWidth} solid #000;
                padding: ${fontSizes.padding};
                min-height: 65px;
                overflow: hidden;
              }

              .detail-title {
                font-weight: bold;
                font-size: ${fontSizes.titleFontSize}px;
              }

              .product-section {
                border: ${fontSizes.borderWidth} solid #000;
                padding: ${fontSizes.padding};
                margin-top: 2px;
                min-height: 50px;
                overflow: hidden;
              }

              .product-title {
                font-weight: bold;
                font-size: ${fontSizes.titleFontSize}px;
                margin-bottom: 1px;
              }

              .product-list {
                white-space: normal;
                word-wrap: break-word;
                line-height: ${formattedOrder.products.length > 6 ? Math.max(fontSizes.lineHeight - 0.2, 0.7) : fontSizes.lineHeight};
                font-size: ${formattedOrder.products.length > 6 ? Math.max(fontSizes.smallFontSize - 1, 3) : fontSizes.smallFontSize}px;
                overflow: hidden;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                Ship Via: ${formattedOrder.shipVia}
              </div>

              <div class="order-id">
                ${previewFromAddress.name} Order ID: ${formattedOrder.id}
              </div>

              <div class="barcode-wrapper">
                <svg id="barcode-${formattedOrder.id}" class="barcode-img"></svg>
              </div>

              <div class="address-box">
                <div class="to-name">TO ${formattedOrder.toAddress.name}</div>
                <div class="address-line">${formattedOrder.toAddress.street}</div>
                <div class="address-line">${formattedOrder.toAddress.city}</div>
                <div class="address-line">${formattedOrder.toAddress.state} ${formattedOrder.toAddress.zipCode}</div>
                <div class="address-line">${formattedOrder.toAddress.phone}</div>
              </div>

              <div class="details-grid">
                <div class="detail-box">
                  <div class="detail-title">From:</div>
                  <div class="address-line">${previewFromAddress.name}</div>
                  <div class="address-line">${previewFromAddress.street}</div>
                  <div class="address-line">${previewFromAddress.city}</div>
                  <div class="address-line">${previewFromAddress.state}-${previewFromAddress.zipCode}</div>
                  <div class="address-line">Mobile: ${previewFromAddress.phone}</div>
                </div>

                <div class="detail-box">
                  <div class="detail-title">
                    Prepaid Order:
                  </div>
                  <div class="address-line">Date: ${formattedOrder.orderDate}</div>
                  <div class="address-line">Weight: </div>
                  <div class="address-line">No. of Items: ${formattedOrder.totalItems}</div>
                  <div class="address-line">Source: Instagram</div>
                  <div class="address-line">Packed By: </div>
                </div>
              </div>

              <div class="product-section">
                <div class="product-title">Products:</div>
                <div class="product-list">
                  ${formatProductsList(formattedOrder.products)}
                </div>
              </div>
            </div>
            <script>
              window.onload = function() {
                JsBarcode("#barcode-${formattedOrder.id}", "${formattedOrder.id}", {
                  format: "CODE128",
                  width: ${barcodeWidth},
                  height: ${barcodeHeight},
                  displayValue: false,
                  margin: 0
                });

                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 500);
              };
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
      setTimeout(() => {
        downloadBillDataAsPDF(billId, responseOrder, selectedTemplate)
      }, 1000)
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to print bill. Please try again.'}`)
      console.error('Print error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Open Bulk Preview Function
  const openBulkPreview = async () => {
    if (!isAddressSaved || !selectedTemplate) {
      alert('Please add your address and select a template first')
      return
    }

    try {
      setIsLoading(true)
      const resp = await publicApi.get('/api/printingroute/bulkPrinting', {
        headers: { 'tenent-id': tenentId || '' },
        params: { dryRun: 1, limit: 50 }
      })

      const { aggregatedProducts = [], totals = { totalBills: 0, totalItems: 0 } } = resp.data || {}
      setBulkPreviewData({ aggregatedProducts, totals })
      setShowBulkPreview(true)
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message || 'Failed to load preview')
    } finally {
      setIsLoading(false)
    }
  }

  // Proceed with Actual Bulk Print
  const proceedBulkPrint = async () => {
    setShowBulkPreview(false)
    await handleBulkPrint()
  }

  // Download Product Summary as PDF
  const downloadProductSummaryPDF = () => {
    const { aggregatedProducts, totals } = bulkPreviewData

    if (!aggregatedProducts.length) {
      alert("No product data available to download.")
      return
    }

    const doc = new jsPDF()

    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.text("Bulk Print Product Summary", 20, 20)

    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(`Total Orders: ${totals.totalBills}`, 20, 35)
    doc.text(`Total Product Quantity: ${totals.totalItems}`, 20, 45)

    let y = 60
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("Product", 20, y)
    doc.text("Quantity", 160, y)

    // Underline header row
    doc.setLineWidth(0.5)
    doc.line(20, y + 2, 190, y + 2)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    y += 12

    aggregatedProducts.forEach((item) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      doc.text(item.productName, 20, y)
      doc.text(item.quantity.toString(), 160, y)
      y += 8
    })

    const fileName = `Bulk_Summary_${new Date().toISOString().split("T")[0]}.pdf`
    doc.save(fileName)
  }

  const handleBulkPrint = async () => {
    if (!isAddressSaved) {
      alert('Please enter your shipping from address before printing in bulk')
      return
    }

    try {
      setIsLoading(true)
      const response = await publicApi.get('/api/printingroute/bulkPrinting', {
        headers: {
          'tenent-id': tenentId || ''
        }
      })

      if (!response.data.bills || response.data.bills.length === 0) {
        alert('No bills available for printing')
        return
      }

      const printContent = generateBulkPrintContent(response.data.bills)
      const printWindow = window.open('', '_blank')

      if (!printWindow) {
        alert('Unable to open print window. Please disable your pop-up blocker and try again.')
        return
      }

      printWindow.document.open()
      printWindow.document.write(printContent)
      printWindow.document.close()

      printWindow.onload = function () {
        setTimeout(() => {
          try {
            printWindow.focus()
            printWindow.print()
            setBills(0)
          } catch (error) {
            console.error("Print error:", error)
            alert("There was an error while trying to print. Please try again.")
          } finally {
            printWindow.close()
            setTimeout(() => {
              downloadBulkBillsDataAsPDF(response.data.bills)
            }, 1000)
          }
        }, 500)
      }
    } catch (error: any) {
      alert(`Error: ${error.message || 'Error during printing. Please try again.'}`)
      console.error('Bulk print error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateBulkPrintContent = (bills: BillResponseType[]) => {
    const templateWidth = (selectedTemplate?.width || 384) / 96
    const templateHeight = (selectedTemplate?.height || 384) / 96

    const getFontSizes = (template: TemplateType | null) => {
      if (template?.id === '2x4' || (template?.width && template.width <= 192)) {
        return {
          baseFontSize: 5,
          titleFontSize: 6,
          smallFontSize: 4,
          letterSpacing: '-0.4px',
          lineHeight: 0.8,
          padding: '1px',
          borderWidth: '0.5px'
        }
      }
      else if (template?.id === '4x4' || (template?.width && template.width <= 384)) {
        return {
          baseFontSize: 11,
          titleFontSize: 12,
          smallFontSize: 10,
          letterSpacing: 'normal',
          lineHeight: 1.2,
          padding: '4px',
          borderWidth: '1px'
        }
      }
      else {
        return {
          baseFontSize: 14,
          titleFontSize: 16,
          smallFontSize: 12,
          letterSpacing: 'normal',
          lineHeight: 1.3,
          padding: '6px',
          borderWidth: '1px'
        }
      }
    }

    const fontSizes = getFontSizes(selectedTemplate)
    const barcodeWidth = selectedTemplate?.id === '2x4' ? 0.8 : 1.2
    const barcodeHeight = selectedTemplate?.id === '2x4' ? 25 : 40

    const styles = `
      <style>
        @media print {
          @page {
            size: ${templateWidth}in ${templateHeight}in;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            width: ${selectedTemplate?.width || 384}px !important;
            height: ${selectedTemplate?.height || 384}px !important;
            max-height: ${selectedTemplate?.height || 384}px !important;
            overflow: hidden;
          }
          .page-container {
            width: 100% !important;
            height: 100% !important;
            page-break-after: always;
            overflow: hidden !important;
            box-sizing: border-box;
          }
          .container {
            width: 100% !important;
            height: 100% !important;
            page-break-after: avoid;
            overflow: hidden !important;
            box-sizing: border-box;
            padding: ${fontSizes.padding} !important;
            padding-top: 8px !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            padding-bottom: 8px !important;
            border: 0 !important;
          }
        }

        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          font-size: ${fontSizes.baseFontSize}px;
          line-height: ${fontSizes.lineHeight};
          font-weight: 500;
          letter-spacing: ${fontSizes.letterSpacing};
        }

        .page-container {
          width: ${selectedTemplate?.width || 384}px;
          height: ${selectedTemplate?.height || 384}px;
          page-break-after: always;
          margin: 0 auto;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .container {
          width: ${selectedTemplate?.width || 384}px;
          height: ${selectedTemplate?.height || 384}px;
          margin: 0 auto;
          padding: ${fontSizes.padding};
          padding-top: 8px;
          padding-left: 12px;
          padding-right: 12px;
          padding-bottom: 8px;
          box-sizing: border-box;
          position: relative;
          border: 0;
          overflow: hidden;
        }

        .header {
          font-size: ${fontSizes.titleFontSize}px;
          font-weight: bold;
          margin-top: 5px;
          margin-bottom: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .order-id {
          font-size: ${fontSizes.titleFontSize}px;
          font-weight: bold;
          margin-bottom: 2px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .barcode-wrapper {
          text-align: center;
          margin: 4px auto;
          height: ${barcodeHeight}px;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 90%;
        }

        .barcode-img {
          max-height: 100%;
          max-width: 100%;
        }

        .address-box {
          border: ${fontSizes.borderWidth} solid #000;
          padding: ${fontSizes.padding};
          margin-bottom: 2px;
          min-height: 80px;
          overflow: hidden;
        }

        .to-name {
          font-weight: bold;
          font-size: ${fontSizes.titleFontSize}px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

       .address-line {
          white-space: normal;
          word-wrap: break-word;
          line-height: ${fontSizes.lineHeight};
          font-size: ${fontSizes.baseFontSize}px;
          overflow: hidden;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px;
          margin-bottom: 2px;
        }

        .detail-box {
          border: ${fontSizes.borderWidth} solid #000;
          padding: ${fontSizes.padding};
          min-height: 65px;
          overflow: hidden;
        }

        .detail-title {
          font-weight: bold;
          font-size: ${fontSizes.titleFontSize}px;
        }

        .product-section {
          border: ${fontSizes.borderWidth} solid #000;
          padding: ${fontSizes.padding};
          margin-top: 2px;
          min-height: 50px;
          overflow: hidden;
        }

        .product-title {
          font-weight: bold;
          font-size: ${fontSizes.titleFontSize}px;
          margin-bottom: 1px;
        }

        .product-list {
          white-space: normal;
          word-wrap: break-word;
          overflow: hidden;
        }
      </style>
    `

    const formatProductsList = (products: Array<{ productName?: string; name?: string; quantity: number }>): string => {
      if (!products || products.length === 0) {
        return "No products"
      }

      const totalProducts = products.length
      let fontSize = fontSizes.smallFontSize
      let lineHeight = fontSizes.lineHeight

      if (totalProducts > 6) {
        fontSize = Math.max(fontSize - 1, 3)
        lineHeight = Math.max(lineHeight - 0.1, 0.7)
      }

      if (totalProducts > 10) {
        fontSize = Math.max(fontSize - 1, 2)
        lineHeight = Math.max(lineHeight - 0.1, 0.6)
      }

      if (selectedTemplate?.id === '2x4') {
        return products.map(product => {
          const productName = product.productName || product.name
          const truncatedName = productName && productName.length > 10
            ? productName.substring(0, 9) + '…'
            : productName
          return `${truncatedName} × ${product.quantity}`
        }).join(', ')
      }

      return products.map(product => {
        const productName = product.productName || product.name
        return `${productName} × ${product.quantity}`
      }).join(', ')
    }

    const generateLabelHTML = (bill: BillResponseType) => {
      const totalItems = bill.product_details.reduce((total, product) => total + product.quantity, 0)
      const productCount = bill.product_details.length

      const fromAddress = {
        name: bill.organisation_details.Name || previewFromAddress.name,
        street: bill.organisation_details.street || previewFromAddress.street,
        city: bill.organisation_details.district || previewFromAddress.city,
        state: bill.organisation_details.state || previewFromAddress.state,
        zipCode: bill.organisation_details.pincode || previewFromAddress.zipCode,
        phone: bill.organisation_details.phone || previewFromAddress.phone
      }

      return `
        <div class="page-container">
          <div class="container">
            <div class="header">
              Ship Via: ${bill.shipping_details?.method_name || 'Standard Shipping'}
            </div>

            <div class="order-id">
              ${fromAddress.name} Order ID: ${bill.bill_details.bill_no}
            </div>

            <div class="barcode-wrapper">
              <svg id="barcode-${bill.bill_id}" class="barcode-img"></svg>
            </div>

            <div class="address-box">
              <div class="to-name">TO ${bill.customer_details.name}</div>
              <div class="address-line">${(bill.customer_details.flat_no ? bill.customer_details.flat_no + ', ' : '') + bill.customer_details.street}</div>
              <div class="address-line">${bill.customer_details.district}</div>
              <div class="address-line">${bill.customer_details.state} ${bill.customer_details.pincode}</div>
              <div class="address-line">${bill.customer_details.phone}</div>
            </div>

            <div class="details-grid">
              <div class="detail-box">
                <div class="detail-title">From:</div>
                <div class="address-line">${fromAddress.name}</div>
                <div class="address-line">${fromAddress.street}</div>
                <div class="address-line">${fromAddress.city}</div>
                <div class="address-line">${fromAddress.state}-${fromAddress.zipCode}</div>
                <div class="address-line">Mobile: ${fromAddress.phone}</div>
              </div>

              <div class="detail-box">
                <div class="detail-title">
                  Prepaid Order:
                </div>
                <div class="address-line">Date: ${bill.bill_details.date}, ${bill.bill_details.time}</div>
                <div class="address-line">Weight: </div>
                <div class="address-line">No. of Items: ${totalItems}</div>
                <div class="address-line">Source: Instagram</div>
                <div class="address-line">Packed By: </div>
              </div>
            </div>

            <div class="product-section" style="min-height: ${50 - (productCount > 6 ? 10 : 0)}px;">
              <div class="product-title">Products:</div>
              <div class="product-list" style="line-height: ${productCount > 6 ? Math.max(fontSizes.lineHeight - 0.2, 0.7) : fontSizes.lineHeight}; font-size: ${productCount > 6 ? Math.max(fontSizes.smallFontSize - 1, 3) : fontSizes.smallFontSize}px;">
                ${formatProductsList(bill.product_details)}
              </div>
            </div>
          </div>
        </div>
      `
    }

    const billsHTML = bills.map(bill => generateLabelHTML(bill)).join('')

    const barcodeInitScript = bills.map(bill => {
      return `
        JsBarcode("#barcode-${bill.bill_id}", "${bill.bill_details.bill_no}", {
          format: "CODE128",
          width: ${barcodeWidth},
          height: ${barcodeHeight},
          displayValue: false,
          margin: 0
        });
      `
    }).join('\n')

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Print Bills</title>
          ${styles}
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"></script>
        </head>
        <body>
          ${billsHTML}
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              try {
                ${barcodeInitScript}

                setTimeout(function() {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 1000);
              } catch(error) {
                console.error('Error generating barcodes:', error);
                alert('There was an error generating the barcodes. Please try again.');
              }
            });
          </script>
        </body>
      </html>
    `
  }

  const renderTemplatePreview = (template: TemplateType) => {
    return (
      <div
        className="border border-gray-300 p-2 bg-white overflow-hidden relative"
        style={{ position: "relative", height: "120px" }}
      >
        <div className="absolute inset-0 p-2">
          <ShippingLabelTemplate template={template} fromAddress={previewFromAddress} order={order} />
        </div>
      </div>
    )
  }

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div className="space-y-2.5 sm:space-y-4">
          <div className="rounded-[16px] border border-slate-200 bg-white p-1 shadow-sm sm:rounded-[20px]">
            <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-slate-100 p-1 sm:rounded-[16px]">
              <button
                type="button"
                onClick={() => setActivePrintSection("labels")}
                className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-3 ${
                  activePrintSection === "labels"
                    ? "bg-[#2F2F33] text-white shadow-sm"
                    : "bg-transparent text-slate-600 hover:bg-white/70"
                }`}
              >
                Bulk Print
              </button>
              <button
                type="button"
                onClick={() => setActivePrintSection("single")}
                className={`rounded-[12px] px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-3 ${
                  activePrintSection === "single"
                    ? "bg-[#2F2F33] text-white shadow-sm"
                    : "bg-transparent text-slate-600 hover:bg-white/70"
                }`}
              >
                Single Print
              </button>
            </div>
          </div>

          {activePrintSection === "labels" && (
          <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm sm:rounded-[22px]">
            <div className="border-b border-slate-200 bg-white px-3 py-4 sm:px-5 sm:py-5">
              <div className="flex flex-col items-center text-center">
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#D63031] sm:mb-3 sm:h-12 sm:w-12 sm:rounded-xl">
                  <Printer className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Print Labels</h2>
                <p className="mt-1 text-[11px] text-slate-500 sm:text-sm">Generate shipping labels for ready orders</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#D63031] shadow-sm sm:h-10 sm:w-10 sm:rounded-xl">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-500 sm:text-xs">Orders Ready</p>
                  <p className="text-xl font-bold leading-none text-gray-900 sm:text-2xl">{bills}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2.5">
                <button
                  onClick={() => {
                    setBillId("")
                    setShowPrintHistory(false)
                  }}
                  className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <RotateCcw className="mr-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Reset
                </button>
                <button
                  onClick={openBulkPreview}
                  disabled={bills === 0 || !isAddressSaved || !selectedTemplate}
                  className="flex items-center justify-center rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  <Printer className="mr-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Print All ({bills})
                </button>
              </div>
            </div>
          </div>
          )}

          {activePrintSection === "single" && (
          <div className="rounded-[16px] border border-slate-200 bg-white p-2.5 shadow-sm sm:rounded-[20px] sm:p-4">
            <div className="mb-2.5 flex items-center gap-2 text-gray-900 sm:mb-3">
              <Printer className="h-4 w-4 text-[#D63031]" />
              <h3 className="text-lg font-bold tracking-tight sm:text-xl">Single Print</h3>
            </div>

            <div className="space-y-2 sm:space-y-2.5">
              <input
                type="text"
                value={billId}
                onChange={(e) => setBillId(e.target.value)}
                placeholder="Enter Order ID"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-[#F57F26] focus:bg-white focus:ring-2 focus:ring-[#F57F26]/10 sm:rounded-xl sm:px-3.5 sm:py-3 sm:text-sm"
              />

              <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <button
                  onClick={() => handlePrintBill(billId)}
                  disabled={!isAddressSaved || !selectedTemplate || !billId}
                   className="rounded-lg bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-3"
                >
                  Print Label
                </button>
                <button
                  onClick={async () => {
                    if (billId) {
                      await downloadBillDataAsPDF(billId)
                      setBillId("")
                    }
                  }}
                  disabled={!billId}
                   className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-3"
                >
                  Download PDF
                </button>
                <button
                  onClick={handlePrint}
                  disabled={!isAddressSaved || !selectedTemplate}
                   className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-3"
                >
                  Preview Sample
                  <ArrowRight className="ml-2 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>
            </div>

            {printHistory.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowPrintHistory(!showPrintHistory)}
                    className="flex items-center text-sm font-medium text-[#D63031]"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {showPrintHistory ? "Hide" : "Show"} recent bills
                </button>

                {showPrintHistory && (
                  <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:rounded-xl sm:p-2.5">
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500 sm:text-xs sm:tracking-[0.18em]">Recent Bills</div>
                    <div className="flex flex-wrap gap-2">
                      {printHistory.map((id) => (
                        <button
                          key={id}
                          onClick={() => {
                            setBillId(id)
                            setShowPrintHistory(false)
                          }}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-slate-300 hover:bg-slate-50 sm:px-3 sm:py-1 sm:text-xs"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          <div className="rounded-[16px] border border-slate-200 bg-white p-2.5 shadow-sm sm:rounded-[20px] sm:p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-gray-900">
                <MapPin className="h-4 w-4 text-[#D63031]" />
                <div>
                  <h3 className="text-lg font-bold tracking-tight sm:text-xl">Settings</h3>
                  <p className="text-[11px] text-gray-500 sm:text-xs">Address and label configuration</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsEditingAddress(true)
                  setShowTemplateEdit(true)
                }}
                className="text-sm font-semibold text-[#D63031] transition hover:text-[#b92c2d]"
              >
                Edit
              </button>
            </div>

            <div className="mt-2.5 grid gap-2.5 sm:mt-3 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-2">
                {isAddressSaved ? (
                  <>
                    <p className="text-sm font-semibold text-gray-900 sm:text-base">{fromAddress.name}</p>
                    <p className="text-xs text-gray-600 sm:text-sm">{fromAddress.street}</p>
                    <p className="text-xs text-gray-600 sm:text-sm">
                      {fromAddress.city}, {fromAddress.state}
                    </p>
                    <p className="text-xs text-gray-600 sm:text-sm">{fromAddress.zipCode}</p>
                    <p className="text-xs text-gray-600 sm:text-sm">Phone: {fromAddress.phone}</p>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2.5 text-xs text-gray-600 sm:rounded-xl sm:p-3 sm:text-sm">
                    No address saved yet. Use Edit to add the shipping-from address and choose your label size.
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:rounded-xl sm:p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gray-500 sm:text-xs sm:tracking-[0.18em]">Selected Format</p>
                <p className="mt-1.5 text-sm font-semibold text-gray-900 sm:text-base">
                  {selectedTemplate?.name || "No template selected"}
                </p>
                {selectedTemplate?.description && (
                  <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">{selectedTemplate.description}</p>
                )}
                <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white sm:mt-3 sm:rounded-xl">
                  <div className="h-20 sm:h-24">{selectedTemplate ? renderTemplatePreview(selectedTemplate) : null}</div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-2.5 sm:mt-4 sm:gap-2.5 sm:pt-3 sm:flex-row">
              <button
                onClick={async () => {
                  try {
                    setIsLoading(true)
                    const response = await publicApi.get("/api/printingroute/bulkPrinting", {
                      headers: {
                        "tenent-id": tenentId || "",
                      },
                    })

                    if (response.data.bills && response.data.bills.length > 0) {
                      await downloadBulkBillsDataAsPDF(response.data.bills)
                      setBills(0)
                    } else {
                      alert("No bills available for download")
                    }
                  } catch (error: any) {
                    alert(`Error: ${error.message || "Failed to download bills data"}`)
                  } finally {
                    setIsLoading(false)
                  }
                }}
                disabled={bills === 0 || !isAddressSaved || !selectedTemplate}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
              >
                Download All PDFs
              </button>
            </div>

            {bills > 0 && (!isAddressSaved || !selectedTemplate) && (
              <p className="mt-3 text-sm text-amber-600">
                {!isAddressSaved
                  ? "Please add your address before printing."
                  : "Please select a template before printing."}
              </p>
            )}
          </div>

          {(isEditingAddress || showTemplateEdit) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-4 backdrop-blur-[2px]">
              <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-[18px] bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-xl sm:rounded-[22px]">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 sm:text-xl">Edit Address & Settings</h2>
                    <p className="mt-1 text-[11px] text-gray-500 sm:text-xs">Update sender details and preferred label size</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsEditingAddress(false)
                      setShowTemplateEdit(false)
                    }}
                    className="rounded-full p-1.5 text-gray-500 transition hover:bg-white hover:text-gray-800 sm:p-2"
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitFromAddress} className="max-h-[calc(90vh-88px)] overflow-y-auto">
                  <div className="space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
                    <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700">Business/Name*</label>
                        <input
                          type="text"
                          name="name"
                          value={fromAddress.name}
                          onChange={handleFromAddressChange}
                           className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F57F26]/10 focus:border-[#F57F26] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700">Street Address*</label>
                        <input
                          type="text"
                          name="street"
                          value={fromAddress.street}
                          onChange={handleFromAddressChange}
                           className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F57F26]/10 focus:border-[#F57F26] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">City*</label>
                        <input
                          type="text"
                          name="city"
                          value={fromAddress.city}
                          onChange={handleFromAddressChange}
                           className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F57F26]/10 focus:border-[#F57F26] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">State*</label>
                        <input
                          type="text"
                          name="state"
                          value={fromAddress.state}
                          onChange={handleFromAddressChange}
                           className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F57F26]/10 focus:border-[#F57F26] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">ZIP/Postal Code*</label>
                        <input
                          type="text"
                          name="zipCode"
                          value={fromAddress.zipCode}
                          onChange={handleFromAddressChange}
                           className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F57F26]/10 focus:border-[#F57F26] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number*</label>
                        <input
                          type="tel"
                          name="phone"
                          value={fromAddress.phone}
                          onChange={handleFromAddressChange}
                           className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F57F26]/10 focus:border-[#F57F26] sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 sm:text-base">Preferred Label Size</h3>
                      <div className="mt-2 grid gap-2 sm:mt-2.5 sm:gap-2.5 sm:grid-cols-2">
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => handleTemplateSelect(template)}
                            className={`rounded-lg border p-2.5 text-left transition sm:rounded-xl sm:p-3 ${
                              selectedTemplate?.id === template.id
                                ? "border-[#F57F26] bg-orange-50/40 shadow-sm"
                                : "border-gray-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                              <div className="flex items-start gap-2.5">
                              <div
                                className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border sm:h-4 sm:w-4 ${
                                  selectedTemplate?.id === template.id
                                    ? "border-[#F57F26] bg-[#F57F26]"
                                    : "border-gray-300 bg-white"
                                }`}
                              >
                                {selectedTemplate?.id === template.id && <div className="h-2 w-2 rounded-full bg-white sm:h-2.5 sm:w-2.5" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                                <p className="text-[11px] text-gray-500 sm:text-xs">
                                  {template.description || `${template.width / 96}x${template.height / 96} inch`}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingAddress(false)
                          setShowTemplateEdit(false)
                        }}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                        disabled={isLoading}
                      >
                        {isLoading ? "Saving..." : "Save Settings"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <OrderPrintPage
        orderData={order}
        fromAddress={previewFromAddress}
        selectedTemplate={selectedTemplate || templates[0]}
        onBack={() => setStep(1)}
      />
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-2 sm:px-3 py-4">
      <div className="mb-4">
        {step === 2 && (
          <button className="mt-2 flex items-center text-[#D63031]" onClick={() => setStep(1)}>
            <ArrowRight className="w-4 h-4 mr-1 transform rotate-180" />
            Back to settings
          </button>
        )}
      </div>

      {isLoading || loadingTemplates ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#F57F26]"></div>
        </div>
      ) : (
        renderStepContent()
      )}

      {/* BULK PREVIEW MODAL */}
      {showBulkPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
          <div className="flex max-h-[85vh] w-[95%] max-w-lg flex-col rounded-lg bg-white p-3 shadow-lg sm:max-h-[80vh] sm:w-full sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Confirm Bulk Print</h3>
              <button
                onClick={() => setShowBulkPreview(false)}
                className="text-gray-600 hover:text-gray-900 text-2xl leading-none px-2"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 space-y-1 text-sm text-gray-700">
              <p><b>Total Orders:</b> {bulkPreviewData.totals.totalBills}</p>
              <p><b>Total Product Quantity:</b> {bulkPreviewData.totals.totalItems}</p>
              <p className="text-gray-500">Review product-wise breakdown below:</p>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="border-b px-3 py-2.5 text-left font-semibold">Product</th>
                      <th className="border-b px-3 py-2.5 text-right font-semibold">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreviewData.aggregatedProducts.map((item, i) => (
                      <tr key={i} className="odd:bg-white even:bg-gray-50 hover:bg-slate-50 transition-colors">
                         <td className="border-b px-3 py-2">{item.productName}</td>
                         <td className="border-b px-3 py-2 text-right font-medium">{item.quantity}</td>
                      </tr>
                    ))}
                    {!bulkPreviewData.aggregatedProducts.length && (
                      <tr>
                        <td colSpan={2} className="py-8 text-center text-gray-500">
                          No items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-col justify-end gap-2.5 sm:flex-row">
              <button
                onClick={() => setShowBulkPreview(false)}
                className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 sm:w-auto"
              >
                Cancel
              </button>

              <button
                onClick={downloadProductSummaryPDF}
                className="flex w-full items-center justify-center rounded-md bg-gray-700 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800 sm:w-auto"
              >
                <Printer className="w-4 h-4 mr-2" />
                Download Summary
              </button>

              <button
                onClick={proceedBulkPrint}
                className="flex w-full items-center justify-center rounded-md bg-orange-600 px-4 py-2 text-sm text-white transition-colors hover:bg-orange-700 sm:w-auto"
              >
                <Printer className="w-4 h-4 mr-2" />
                Proceed to Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrintManagement

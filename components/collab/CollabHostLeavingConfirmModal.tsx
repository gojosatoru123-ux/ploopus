import { motion, AnimatePresence } from 'framer-motion';
interface CollabHostLeavingConfirmModalProps {
    handleCancelLeave: () => void;
    handleConfirmLeave: () => void;
    showLeaveConfirm: boolean;
}
const CollabHostLeavingConfirmModal = ({ handleCancelLeave, handleConfirmLeave, showLeaveConfirm }: CollabHostLeavingConfirmModalProps) => {
    return (
        <>
            <AnimatePresence>
                {showLeaveConfirm && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl p-8 flex flex-col items-center gap-5"
                            initial={{ scale: 0.92, opacity: 0, y: 16 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 16 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        >
                            <h2 className="text-xl font-semibold text-foreground">Leave this session?</h2>
                            <p className="mt-1.5 text-sm text-muted-foreground">
                                Navigating away will end the collaboration session for everyone
                                currently connected. Your changes will be saved first.
                            </p>
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={handleConfirmLeave}
                                    className="text-sm bg-destructive/10 text-destructive hover:bg-destructive/20 px-3 py-1.5 rounded-md transition-colors font-medium"
                                >
                                    Exit
                                </button>
                                <button
                                    onClick={handleCancelLeave}
                                    className="text-sm bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
export default CollabHostLeavingConfirmModal;   